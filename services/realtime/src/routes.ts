import { verifyRealtimeToken, type RealtimeEvent } from "@foundry/realtime";
import type { ChannelRoom } from "./room";

export type Env = { REALTIME_SECRET: string; ROOMS: DurableObjectNamespace<ChannelRoom> };

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i]! ^ y[i]!;
  return d === 0;
}

function validEvent(e: unknown): e is RealtimeEvent {
  if (!e || typeof e !== "object") return false;
  const v = e as Record<string, unknown>;
  const role = v.role === "staff" || v.role === "customer";
  if (v.type === "message") return typeof v.channel === "string";
  if (v.type === "presence") return typeof v.userId === "string" && role && typeof v.online === "boolean";
  if (v.type === "typing") return typeof v.userId === "string" && role && typeof v.typing === "boolean";
  return false;
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/ws" && req.method === "GET") {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("upgrade required", { status: 426 });
    const p = await verifyRealtimeToken(env.REALTIME_SECRET, url.searchParams.get("token") ?? "");
    if (!p) return new Response("unauthorized", { status: 401 });
    const headers = new Headers(req.headers);
    headers.set("x-rt-user", p.u);
    headers.set("x-rt-role", p.r);
    return env.ROOMS.get(env.ROOMS.idFromName(p.c)).fetch(new Request(req, { headers }));
  }

  if (url.pathname === "/publish" && req.method === "POST") {
    const auth = req.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${env.REALTIME_SECRET}`)) return new Response("unauthorized", { status: 401 });
    const body = (await req.json().catch(() => null)) as { channel?: unknown; event?: unknown } | null;
    if (!body || typeof body.channel !== "string" || !body.channel || !validEvent(body.event)) {
      return new Response("bad request", { status: 400 });
    }
    await env.ROOMS.get(env.ROOMS.idFromName(body.channel)).publish(body.event);
    return new Response(null, { status: 204 });
  }

  if (url.pathname === "/") return new Response("ok");
  return new Response("not found", { status: 404 });
}
