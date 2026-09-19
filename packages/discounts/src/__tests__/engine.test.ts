import { describe, expect, it } from "vitest";
import { isRuleActive, resolveCatalogDiscounts } from "../engine";

const r = (key: string, percent: number) => ({ key, name: key, kind: "k", percent });
const sum = (l: { amount: number }[]) => Math.round(l.reduce((s, x) => s + x.amount, 0) * 100) / 100;

describe("resolveCatalogDiscounts", () => {
  it("single rule", () => {
    const o = resolveCatalogDiscounts([r("a", 10)], { subtotal: 200, maxDiscountPct: 50 });
    expect(o).toMatchObject({ totalPercent: 10, totalAmount: 20, capped: false });
    expect(o.lines[0]).toMatchObject({ percent: 10, listedPercent: 10, amount: 20 });
  });
  it("adds up", () => {
    const o = resolveCatalogDiscounts([r("a", 10), r("b", 5)], { subtotal: 100, maxDiscountPct: 50 });
    expect(o.totalAmount).toBe(15);
    expect(o.capped).toBe(false);
  });
  it("scales to cap with exact-cent sum", () => {
    const o = resolveCatalogDiscounts([r("a", 10), r("b", 20)], { subtotal: 100, maxDiscountPct: 25 });
    expect(o.capped).toBe(true);
    expect(o.totalAmount).toBe(25);
    expect(o.lines.map((l) => l.amount)).toEqual([8.33, 16.67]);
    expect(sum(o.lines)).toBe(o.totalAmount);
    expect(o.lines[0].listedPercent).toBe(10);
  });
  it("last line absorbs rounding", () => {
    const o = resolveCatalogDiscounts([r("a", 1), r("b", 1), r("c", 1)], { subtotal: 33.33, maxDiscountPct: 2 });
    expect(sum(o.lines)).toBe(o.totalAmount);
  });
  it("ignores zero, negative, NaN", () => {
    const o = resolveCatalogDiscounts([r("a", 0), r("b", -5), r("c", NaN), r("d", 10)], {
      subtotal: 100,
      maxDiscountPct: 50,
    });
    expect(o.lines.map((l) => l.key)).toEqual(["d"]);
  });
  it("maxDiscountPct 0 yields nothing", () => {
    const o = resolveCatalogDiscounts([r("a", 10)], { subtotal: 100, maxDiscountPct: 0 });
    expect(o.totalAmount).toBe(0);
    expect(o.capped).toBe(true);
  });
});

describe("isRuleActive", () => {
  it("checks flag and window", () => {
    expect(isRuleActive({ active: false }, 5)).toBe(false);
    expect(isRuleActive({ active: true, startsAt: 10 }, 5)).toBe(false);
    expect(isRuleActive({ active: true, endsAt: 4 }, 5)).toBe(false);
    expect(isRuleActive({ active: true, startsAt: 1, endsAt: 9 }, 5)).toBe(true);
  });
});
