import { describe, expect, it } from "vitest";
import { calculateDeliveryCharge } from "../charges";

describe("calculateDeliveryCharge", () => {
  it("sums base + fixed strategy + percent tag on the plan price", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 2,
      deliveryStrategy: { name: "Doorstep", chargeType: "fixed", chargeValue: 1 },
      addressTag: { name: "Condo", chargeType: "percent", chargeValue: 5 },
      planPrice: 100,
    });
    expect(r.totalDeliveryCharge).toBe(8);
    expect(r.lines.map((l) => l.amount)).toEqual([2, 1, 5]);
  });

  it("treats 'none' as zero and omits zero lines", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 0,
      deliveryStrategy: { name: "Standard", chargeType: "none", chargeValue: 9 },
      planPrice: 100,
    });
    expect(r.totalDeliveryCharge).toBe(0);
    expect(r.deliveryStrategy?.amount).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it("clamps negatives and handles missing rules", () => {
    const r = calculateDeliveryCharge({
      baseCharge: -5,
      deliveryStrategy: { name: "Bad", chargeType: "fixed", chargeValue: -10 },
      addressTag: null,
      planPrice: 50,
    });
    expect(r.baseAmount).toBe(0);
    expect(r.totalDeliveryCharge).toBe(0);
    expect(r.addressTag).toBeNull();
  });

  it("rounds percent charges to cents", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 0,
      addressTag: { name: "Tag", chargeType: "percent", chargeValue: 3.33 },
      planPrice: 99.99,
    });
    expect(r.totalDeliveryCharge).toBe(3.33);
  });
});
