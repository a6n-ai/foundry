import { getServerByName } from "partyserver"
import { verifyRoomToken } from "../token"
import type { CollabRoom } from "./room"

export type RouteCollabOptions = {
  namespace: DurableObjectNamespace<CollabRoom<any>>
  secret: string
  origin: string
  prefix?: string
}

const DOC_ID = /^[A-Za-z0-9_-]{1,64}$/

/** WebSocket entry for the app's Worker. `null` when the request is not for a room. */
export async function routeCollabRequest(request: Request, opts: RouteCollabOptions): Promise<Response | null> {
  const url = new URL(request.url)
  const prefix = opts.prefix ?? "/collab/"
  if (!url.pathname.startsWith(prefix)) return null
  const refuse = (status: number) => new Response(null, { status })
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return refuse(426)
  const origin = request.headers.get("Origin")
  if (origin !== null && origin !== opts.origin) return refuse(403)
  const claims = await verifyRoomToken(opts.secret, url.searchParams.get("token") ?? "")
  if (!claims) return refuse(401)
  const docId = url.pathname.slice(prefix.length)
  if (!DOC_ID.test(docId)) return refuse(404)
  if (claims.doc !== docId) return refuse(403)
  const room = await getServerByName(opts.namespace, docId)
  return room.fetch(request)
}

export function roomControl(namespace: DurableObjectNamespace<CollabRoom<any>>) {
  return {
    async revoke(docId: string, shareId: string): Promise<void> {
      const room = await getServerByName(namespace, docId)
      await room.revoke(shareId)
    },
  }
}

export type RoomControl = ReturnType<typeof roomControl>
