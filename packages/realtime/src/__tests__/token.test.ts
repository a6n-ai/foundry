import { describe, expect, it } from "vitest";
import { signRealtimeToken, verifyRealtimeToken } from "../token";

const p = { channel: "notify:u1", userId: "u1", role: "customer" as const };
const now = 1_700_000_000_000;

describe("realtime token", () => {
  it("round-trips channel, userId, role", async () => {
    const t = await signRealtimeToken("s", p, 60, now);
    expect(await verifyRealtimeToken("s", t, now)).toEqual({
      c: "notify:u1",
      u: "u1",
      r: "customer",
      e: Math.floor(now / 1000) + 60,
    });
  });

  it("rejects an expired token", async () => {
    const t = await signRealtimeToken("s", p, 60, now);
    expect(await verifyRealtimeToken("s", t, now + 61_000)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const t = await signRealtimeToken("s", p, 60, now);
    const flipped = (t[0] === "A" ? "B" : "A") + t.slice(1);
    expect(await verifyRealtimeToken("s", flipped, now)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const t = await signRealtimeToken("s", p, 60, now);
    expect(await verifyRealtimeToken("other", t, now)).toBeNull();
  });

  it("rejects malformed input", async () => {
    for (const bad of ["", "abc", "a.b.c"]) {
      expect(await verifyRealtimeToken("s", bad, now)).toBeNull();
    }
  });
});
