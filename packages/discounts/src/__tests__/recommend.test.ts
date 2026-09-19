import { describe, expect, it } from "vitest";
import { bestDeal, rankDeals } from "../recommend";

const alt = (id: string, total: number, units: number) => ({ id, label: id, total, units, payload: id });

describe("rankDeals", () => {
  const cur = { total: 100, units: 10 };
  it("ranks best per-unit first and drops non-improving", () => {
    const o = rankDeals(cur, [alt("a", 160, 20), alt("b", 250, 20), alt("c", 90, 10), alt("d", 100, 10)]);
    expect(o.map((d) => d.id)).toEqual(["a", "c"]);
    expect(o[1]).toMatchObject({ perUnit: 9, savingPerUnit: 1, savingPct: 10, totalDelta: -10 });
  });
  it("limit and minSavingPct", () => {
    const alts = [alt("c", 90, 10), alt("a", 180, 20), alt("e", 99.5, 10)];
    expect(rankDeals(cur, alts, { limit: 1 }).map((d) => d.id)).toEqual(["c"]);
    expect(rankDeals(cur, alts).map((d) => d.id)).not.toContain("e");
  });
  it("units 0 is safe", () => {
    expect(rankDeals({ total: 10, units: 0 }, [alt("a", 1, 1)])).toEqual([]);
    expect(rankDeals(cur, [alt("a", 1, 0)])).toEqual([]);
  });
  it("bestDeal", () => {
    expect(bestDeal(cur, [alt("c", 90, 10)])?.id).toBe("c");
    expect(bestDeal(cur, [])).toBeNull();
  });
});
