import { describe, expect, it, vi } from "vitest";
import { memoryBus } from "../memory-bus";
import { createRemoteBus, pickBus } from "../remote-bus";

const event = { type: "message", channel: "notify:u1" } as const;

describe("RemoteBus", () => {
  it("publish posts channel and event with bearer secret", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await createRemoteBus({ url: "https://rt.test", secret: "s3cret", fetch }).publish("notify:u1", event);
    expect(fetch).toHaveBeenCalledWith("https://rt.test/publish", {
      method: "POST",
      headers: { authorization: "Bearer s3cret", "content-type": "application/json" },
      body: '{"channel":"notify:u1","event":{"type":"message","channel":"notify:u1"}}',
    });
  });

  it("publish throws on non-2xx", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      createRemoteBus({ url: "https://rt.test", secret: "x", fetch }).publish("c", event),
    ).rejects.toThrow();
  });

  it("subscribe throws", () => {
    expect(() => createRemoteBus({ url: "u", secret: "s" }).subscribe("c", () => {})).toThrow(
      "RemoteBus: clients subscribe via the realtime Worker",
    );
  });

  it("pickBus returns memoryBus without REALTIME_URL", () => {
    expect(pickBus({})).toBe(memoryBus);
  });

  it("pickBus returns a remote bus when both vars set", () => {
    expect(pickBus({ REALTIME_URL: "x", REALTIME_SECRET: "y" })).not.toBe(memoryBus);
  });
});
