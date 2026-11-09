import { describe, expect, it } from "vitest";
import { isRealtimeEvent } from "../index";

describe("isRealtimeEvent", () => {
  it("accepts each event shape", () => {
    expect(isRealtimeEvent({ type: "message", channel: "c" })).toBe(true);
    expect(isRealtimeEvent({ type: "presence", userId: "u", role: "staff", online: true })).toBe(true);
    expect(isRealtimeEvent({ type: "typing", userId: "u", role: "customer", typing: false })).toBe(true);
  });

  it("rejects unknown types, bad roles and wrong field types", () => {
    expect(isRealtimeEvent({ type: "toString" })).toBe(false);
    expect(isRealtimeEvent({ type: "typing", userId: "u", role: "admin", typing: true })).toBe(false);
    expect(isRealtimeEvent({ type: "presence", userId: "u", role: "staff", online: "yes" })).toBe(false);
    expect(isRealtimeEvent(null)).toBe(false);
  });
});
