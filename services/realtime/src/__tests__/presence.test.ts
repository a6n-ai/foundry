import { describe, expect, it } from "vitest";
import { isFirstSocketFor, isLastSocketFor, onlineSnapshot } from "../presence";

const c = { userId: "u1", role: "customer" as const };
const s = { userId: "s1", role: "staff" as const };

describe("presence", () => {
  it("onlineSnapshot dedupes users with several sockets", () => {
    expect(onlineSnapshot([c, c, s])).toHaveLength(2);
  });
  it("isFirstSocketFor is true when no other socket has the user", () => {
    expect(isFirstSocketFor([s], "u1")).toBe(true);
    expect(isFirstSocketFor([c, s], "u1")).toBe(false);
  });
  it("isLastSocketFor is false while another socket of the same user remains", () => {
    expect(isLastSocketFor([c], "u1")).toBe(false);
    expect(isLastSocketFor([s], "u1")).toBe(true);
  });
});
