import { signRealtimeToken } from "@foundry/realtime";
import { describe, expect, it, vi } from "vitest";
import { handle } from "../routes";

const SECRET = "test-secret";
function mkEnv() {
  const publish = vi.fn(async () => {});
  const fetch = vi.fn(async () => new Response(null, { status: 200 }));
  const idFromName = vi.fn((n: string) => n);
  const get = vi.fn(() => ({ publish, fetch }));
  return { env: { REALTIME_SECRET: SECRET, ROOMS: { idFromName, get } } as never, publish, idFromName, get };
}
const post = (body: unknown, auth = `Bearer ${SECRET}`) =>
  new Request("https://rt/publish", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });

describe("routes", () => {
  it("ws without upgrade header returns 426", async () => {
    const { env } = mkEnv();
    expect((await handle(new Request("https://rt/ws?token=x"), env)).status).toBe(426);
  });
  it("ws with expired token returns 401 and never touches ROOMS", async () => {
    const { env, get } = mkEnv();
    const token = await signRealtimeToken(SECRET, { channel: "notify:u1", userId: "u1", role: "customer" }, 60, Date.now() - 120_000);
    const res = await handle(new Request(`https://rt/ws?token=${token}`, { headers: { upgrade: "websocket" } }), env);
    expect(res.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });
  it("publish with wrong bearer returns 401", async () => {
    const { env } = mkEnv();
    expect((await handle(post({ channel: "a", event: { type: "message", channel: "a" } }, "Bearer nope"), env)).status).toBe(401);
  });
  it("publish with unknown event type returns 400", async () => {
    const { env } = mkEnv();
    expect((await handle(post({ channel: "a", event: { type: "bogus" } }), env)).status).toBe(400);
  });
  it("publish forwards event to the room named by channel", async () => {
    const { env, publish, idFromName } = mkEnv();
    const event = { type: "message", channel: "notify:u1" };
    const res = await handle(post({ channel: "notify:u1", event }), env);
    expect(idFromName).toHaveBeenCalledWith("notify:u1");
    expect(publish).toHaveBeenCalledWith(event);
    expect(res.status).toBe(204);
  });
});
