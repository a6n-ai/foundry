import { describe, expect, it } from "vitest";
import { relationOf } from "../service";

describe("relationOf", () => {
  const me = 1n;
  const them = 2n;
  it("none without a row", () => expect(relationOf(me, undefined)).toBe("none"));
  it("friends when accepted either way", () => {
    expect(relationOf(me, { requesterId: them, addresseeId: me, status: "accepted" })).toBe("friends");
    expect(relationOf(me, { requesterId: me, addresseeId: them, status: "accepted" })).toBe("friends");
  });
  it("outgoing when I asked", () => {
    expect(relationOf(me, { requesterId: me, addresseeId: them, status: "pending" })).toBe("outgoing");
  });
  it("incoming when they asked", () => {
    expect(relationOf(me, { requesterId: them, addresseeId: me, status: "pending" })).toBe("incoming");
  });
});
