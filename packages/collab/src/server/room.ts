import type { Connection, ConnectionContext, WSMessage } from "partyserver"
import { YServer } from "y-partyserver"
import * as Y from "yjs"
import { LIMITS } from "../limits"
import { verifyRoomToken, type RoomClaims } from "../token"
import { RateWindow, Throttle } from "./policy"
import { yDocText } from "./text"

export type CollabEvent = { type: "joined" | "edited"; sub: string; name: string; guest: boolean }

const FULL_MESSAGE = '{"type":"full"}'

const claimsOf = (conn: Connection): RoomClaims | null => {
  const state = conn.state as RoomClaims | null
  return state?.sub ? state : null
}

/** One Durable Object per doc, named by the doc id. Apps subclass it and supply storage. */
export abstract class CollabRoom<E extends Cloudflare.Env = Cloudflare.Env> extends YServer<E> {
  static options = { hibernate: true }
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10_000 }

  private full = false
  private readonly rate = new RateWindow(LIMITS.messagesPerWindow, LIMITS.windowMs)
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
    if (update.byteLength > LIMITS.snapshotBytes) {
      this.full = true
      this.broadcastCustomMessage(FULL_MESSAGE)
      return
    }
    await this.saveSnapshot(this.name, update, yDocText(this.document))
  }

  async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    const claims = await this.authorize(new URL(ctx.request.url).searchParams.get("token"))
    if (!claims) return conn.close(4401, "unauthorized")
    // state first, so a revoke() that lands during the check below still finds this connection
    conn.setState(claims)
    if (claims.share !== null && !(await this.isShareActive(this.name, claims.share, claims.until))) {
      return conn.close(4403, "revoked")
    }
    if (this.joins.allow(claims.sub, Date.now())) this.emitEvent("joined", claims)
    super.onConnect(conn, ctx)
    if (this.full) this.sendCustomMessage(conn, FULL_MESSAGE)
  }

  handleMessage(conn: Connection, message: WSMessage): void {
    const now = Date.now()
    // every relayed change starts as a message, so expired guests are dropped before they can receive it
    this.dropExpired(now)
    const claims = claimsOf(conn)
    if (!claims || (claims.until !== null && now > claims.until)) return
    const size = typeof message === "string" ? message.length : message.byteLength
    if (size > LIMITS.messageBytes) return conn.close(1009, "message too big")
    if (!this.rate.hit(conn.id, now)) return conn.close(4429, "too many messages")
    super.handleMessage(conn, message)
  }

  isReadOnly(conn: Connection): boolean {
    return this.full || !claimsOf(conn)?.edit
  }

  async onClose(conn: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    super.onClose(conn, code, reason, wasClean)
    for (const other of this.getConnections()) if (other.id !== conn.id) return
    await this.onSave()
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
