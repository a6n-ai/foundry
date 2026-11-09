import { describe, expect, it } from "vitest";
import { withConcurrency } from "./concurrency";

describe("withConcurrency", () => {
  it("keeps input order and never exceeds the limit", async () => {
    let live = 0;
    let peak = 0;
    const out = await withConcurrency([3, 1, 2, 4], async (n) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, n));
      live--;
      return n * 2;
    }, 2);
    expect(out).toEqual([6, 2, 4, 8]);
    expect(peak).toBe(2);
  });
});
