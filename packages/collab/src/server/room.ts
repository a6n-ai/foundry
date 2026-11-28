import * as decoding from "lib0/decoding"
import type { Connection, ConnectionContext, WSMessage } from "partyserver"
import { YServer } from "y-partyserver"
import * as Y from "yjs"
import { FULL_CODE, LIMITS } from "../limits"
import { verifyRoomToken, type RoomClaims } from "../token"
import { RateWindow, Throttle } from "./policy"
import { yDocText } from "./text"

export type CollabEvent = { type: "joined" | "edited"; sub: string; name: string; guest: boolean }

// y-protocols wire format: message type, then for sync a step
const SYNC = 0
const AWARENESS = 1
const SYNC_REQUEST = 0

// y-partyserver 2.2.0 keeps the awareness client ids of a connection in its (hibernation-safe) state
const presenceIds = (conn: Connection): number[] =>
  (conn.state as { __ypsAwarenessIds?: number[] } | null)?.__ypsAwarenessIds ?? []

const claimsOf = (conn: Connection): RoomClaims | null => {
  const state = conn.state as RoomClaims | null
  return state?.sub ? state : null
}

/** One Durable Object per doc, named by the doc id. Apps subclass it and supply storage. */
export abstract class CollabRoom<E extends Cloudflare.Env = Cloudflare.Env> extends YServer<E> {
  static options = { hibernate: true }
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10_000 }

  /** Never below the doc's encoded size; unknown (so measured on first use) after a start or a wake. */
  private sizeBound = Number.POSITIVE_INFINITY
  private readonly rate = new RateWindow(LIMITS.messagesPerWindow, LIMITS.windowMs)
  private readonly volume = new RateWindow(LIMITS.bytesPerWindow, LIMITS.windowMs)
  private readonly requests = new RateWindow(LIMITS.syncRequestsPerWindow, LIMITS.windowMs)
  private readonly joins = new Throttle(3_600_000)
  private readonly edits = new Throttle(600_000)

  protected abstract secret(): Promise<string>
  protected abstract loadSnapshot(docId: string): Promise<Uint8Array | null>
  protected abstract saveSnapshot(docId: string, snapshot: Uint8Array, text: string): Promise<void>
  protected abstract onEvent(docId: string, event: CollabEvent): Promise<void>
  /** A room token outlives a revoke by up to its TTL, so every guest connect asks the app again. */
  protected abstract isShareActive(docId: string, shareId: string, until: number | null): Promise<boolean>

  protected async authorize(token: string | null): Promise<RoomClaims | null> {
    if (!token) return null
    const claims = await verifyRoomToken(await this.secret(), token)
    return claims && claims.doc === this.name ? claims : null
  }

  // Also runs on wake from hibernation, which starts with an empty this.document.
  // A throw here aborts the start, so an unloaded room can never save over the stored snapshot.
  async onLoad(): Promise<void> {
    const snapshot = await this.loadSnapshot(this.name)
    if (snapshot) Y.applyUpdate(this.document, snapshot)
  }

  async onStart(): Promise<void> {
    await super.onStart()
    this.document.on("update", (_update: Uint8Array, origin: unknown) => {
      const claims = (origin as { state?: RoomClaims | null } | null)?.state
      if (claims?.sub && this.edits.allow(claims.sub, Date.now())) this.emitEvent("edited", claims)
    })
  }

  async onSave(): Promise<void> {
    const update = Y.encodeStateAsUpdate(this.document)
    // changes are refused before they get this far; never write a doc that could not be stored
    if (update.byteLength > LIMITS.snapshotBytes) return console.error(`collab doc ${this.name} is over the size cap`)
    await this.saveSnapshot(this.name, update, yDocText(this.document))
  }

  async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    const claims = await this.authorize(new URL(ctx.request.url).searchParams.get("token"))
    if (!claims) return conn.close(4401, "unauthorized")
    if (this.crowded(conn, claims)) return conn.close(4429, "too many connections")
    // state first, so a revoke() that lands during the check below still finds this connection
    conn.setState(claims)
    if (claims.share !== null && !(await this.isShareActive(this.name, claims.share, claims.until))) {
      return conn.close(4403, "revoked")
    }
    if (claims.until !== null) await this.wakeBy(claims.until)
    if (this.joins.allow(claims.sub, Date.now())) this.emitEvent("joined", claims)
    super.onConnect(conn, ctx)
    // presence lives only in memory, lost on hibernation, and peers send no heartbeat: ask them again
    this.broadcastCustomMessage('{"type":"who"}', conn)
  }

  handleMessage(conn: Connection, message: WSMessage): void {
    const now = Date.now()
    // every relayed change starts as a message, so expired guests are dropped before they can receive it
    this.dropExpired(now)
    const claims = claimsOf(conn)
    if (!claims || (claims.until !== null && now > claims.until)) return
    const size = typeof message === "string" ? message.length : message.byteLength
    if (size > LIMITS.messageBytes) return conn.close(1009, "message too big")
    if (!this.rate.hit(conn.id, now) || !this.volume.hit(conn.id, now, size)) return conn.close(4429, "too many messages")
    // clients have no text messages to send, and the default handler logs them whole
    if (typeof message === "string") return
    const decoder = decoding.createDecoder(
      message instanceof ArrayBuffer ? new Uint8Array(message) : new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
    )
    try {
      const type = decoding.readVarUint(decoder)
      if (type === AWARENESS && size > LIMITS.awarenessBytes) return
      if (type === SYNC) {
        if (decoding.readVarUint(decoder) === SYNC_REQUEST) {
          if (!this.requests.hit(conn.id, now)) return conn.close(4429, "too many sync requests")
        } else if (!this.isReadOnly(conn) && !this.fits(decoding.readVarUint8Array(decoder))) {
          // dropping it silently would leave the sender ahead of the room, so say why and end the session
          return conn.close(FULL_CODE, "doc full")
        }
      }
    } catch (err) {
      console.error("collab message refused", err)
      return conn.close(1003, "bad message")
    }
    super.handleMessage(conn, message)
  }

  isReadOnly(conn: Connection): boolean {
    return !claimsOf(conn)?.edit
  }

  async onClose(conn: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    // a room that slept cannot emit the removal itself, so peers are told which presence to drop
    const gone = new Set(presenceIds(conn))
    super.onClose(conn, code, reason, wasClean)
    const others = [...this.getConnections()].filter((other) => other.id !== conn.id)
    // a tab that already reconnected keeps its client id and is still here
    for (const other of others) for (const id of presenceIds(other)) gone.delete(id)
    if (!others.length) return this.saveLast()
    if (gone.size) this.broadcastCustomMessage(JSON.stringify({ type: "left", clients: [...gone] }), conn)
  }

  /** RPC: drop every open connection that joined through this share link. */
  async revoke(shareId: string): Promise<number> {
    let closed = 0
    for (const conn of this.getConnections()) {
      if (claimsOf(conn)?.share !== shareId) continue
      conn.close(4403, "revoked")
      closed++
    }
    return closed
  }

  // an idle doc sends no messages, so expiry also needs a timer that outlives hibernation
  async onAlarm(): Promise<void> {
    const now = Date.now()
    this.dropExpired(now)
    const later = [...this.getConnections()].map((c) => claimsOf(c)?.until).filter((u): u is number => u != null && u > now)
    if (later.length) await this.wakeBy(Math.min(...later))
  }

  private async wakeBy(until: number): Promise<void> {
    const at = until + 1
    const set = await this.ctx.storage.getAlarm()
    if (set === null || at < set) await this.ctx.storage.setAlarm(at)
  }

  // nobody is left to send these edits again, so a briefly failing save is retried while the room is awake
  private async saveLast(attempts = 3): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.onSave()
      } catch (err) {
        if (attempt === attempts) throw err
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }

  private crowded(conn: Connection, claims: RoomClaims): boolean {
    const others = [...this.getConnections()].filter((c) => c !== conn).map(claimsOf).filter((c) => c !== null)
    if (others.filter((c) => c.sub === claims.sub).length >= LIMITS.socketsPerPerson) return true
    // staff are never turned away because guests filled the room
    if (claims.share === null) return false
    return others.length >= LIMITS.socketsPerRoom || others.filter((c) => c.share === claims.share).length >= LIMITS.socketsPerShare
  }

  // whether applying this update keeps the doc storable; a shrinking change is always allowed
  private fits(update: Uint8Array): boolean {
    if (this.sizeBound + update.byteLength <= LIMITS.snapshotBytes) {
      this.sizeBound += update.byteLength
      return true
    }
    const current = Y.encodeStateAsUpdate(this.document)
    let next = current.byteLength + update.byteLength
    if (next > LIMITS.snapshotBytes) {
      const trial = new Y.Doc()
      Y.applyUpdate(trial, current)
      Y.applyUpdate(trial, update)
      next = Y.encodeStateAsUpdate(trial).byteLength
      trial.destroy()
      if (next > LIMITS.snapshotBytes && next > current.byteLength) {
        this.sizeBound = current.byteLength
        return false
      }
    }
    this.sizeBound = next
    return true
  }

  private dropExpired(now: number): void {
    for (const conn of this.getConnections()) {
      const until = claimsOf(conn)?.until
      if (until != null && now > until) conn.close(4403, "expired")
    }
  }

  private emitEvent(type: CollabEvent["type"], claims: RoomClaims): void {
    const event = { type, sub: claims.sub, name: claims.name, guest: claims.share !== null }
    this.ctx.waitUntil(this.onEvent(this.name, event).catch((err) => console.error("collab event failed", err)))
  }
}
