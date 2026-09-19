import { describe, expect, it } from "vitest";
import { resolveCart } from "../cart";

const rule = { key: "a", name: "A", kind: "k", percent: 10 };
const cp = (o: object) => ({ id: "c", name: "C", active: true, stackable: true, ...o });
const ctx = { now: 1 };

describe("resolveCart", () => {
  it("applies coupon on remaining", () => {
    const c = resolveCart({ subtotal: 100, rules: [rule], maxDiscountPct: 50, coupons: [cp({ percentOff: 10 })], couponCtx: ctx });
    expect(c.subtotalAfterCatalog).toBe(90);
    expect(c.coupons.total).toBe(9);
    expect(c.totalOff).toBe(19);
    expect(c.finalSubtotal).toBe(81);
  });
  it("minSubtotal uses post-discount subtotal", () => {
    const c = resolveCart({ subtotal: 100, rules: [rule], maxDiscountPct: 50, coupons: [cp({ amountOff: 5, minSubtotal: 95 })], couponCtx: ctx });
    expect(c.coupons.rejected[0].reason).toBe("below_min_subtotal");
  });
  it("exclusive coupons still delegated", () => {
    const c = resolveCart({
      subtotal: 100, rules: [], maxDiscountPct: 0, couponCtx: ctx,
      coupons: [cp({ id: "x", amountOff: 30, stackable: false }), cp({ id: "y", amountOff: 10 }), cp({ id: "z", amountOff: 10 })],
    });
    expect(c.coupons.applied.map((a) => a.id)).toEqual(["x"]);
  });
  it("never exceeds subtotal", () => {
    const c = resolveCart({ subtotal: 50, rules: [{ ...rule, percent: 100 }], maxDiscountPct: 100, coupons: [cp({ amountOff: 40 })], couponCtx: ctx });
    expect(c.totalOff).toBe(50);
    expect(c.finalSubtotal).toBe(0);
  });
});
