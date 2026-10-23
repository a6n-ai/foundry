import { DurableObject } from "cloudflare:workers";
import type { RealtimeEvent, RealtimeRole } from "@foundry/realtime";
import { isFirstSocketFor, isLastSocketFor, onlineSnapshot, type Att } from "./presence";

export class ChannelRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private others(except?: WebSocket): Att[] {
    return this.ctx
      .getWebSockets()
      .filter((w) => w !== except)
      .map((w) => w.deserializeAttachment() as Att | null)
      .filter((a): a is Att => !!a);
  }

  private broadcast(event: RealtimeEvent, except?: WebSocket) {
    const frame = JSON.stringify(event);
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue;
      try {
        w.send(frame);
      } catch {}
    }
  }

  async fetch(req: Request): Promise<Response> {
    const userId = req.headers.get("x-rt-user");
    const role = req.headers.get("x-rt-role") as RealtimeRole | null;
    if (!userId || !role || req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("bad request", { status: 400 });
    }
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    const others = this.others();
    this.ctx.acceptWebSocket(server, [userId]);
    server.serializeAttachment({ userId, role } satisfies Att);
    for (const a of onlineSnapshot(others)) {
      server.send(JSON.stringify({ type: "presence", userId: a.userId, role: a.role, online: true } satisfies RealtimeEvent));
    }
    if (isFirstSocketFor(others, userId)) {
      this.broadcast({ type: "presence", userId, role, online: true }, server);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async publish(event: RealtimeEvent): Promise<void> {
    this.broadcast(event);
  }

  webSocketMessage() {}

  async webSocketClose(ws: WebSocket) {
    this.left(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.left(ws);
  }

  private left(ws: WebSocket) {
    const me = ws.deserializeAttachment() as Att | null;
    if (!me) return;
    const remaining = this.others(ws);
    if (isLastSocketFor(remaining, me.userId)) {
      this.broadcast({ type: "presence", userId: me.userId, role: me.role, online: false }, ws);
    }
  }
}
