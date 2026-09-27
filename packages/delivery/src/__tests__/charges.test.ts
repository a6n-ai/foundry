import { describe, expect, it } from "vitest";
import { calculateDeliveryCharge } from "../charges";

describe("calculateDeliveryCharge", () => {
  it("sums base + fixed strategy + percent tag on the plan price", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 2,
      deliveryStrategies: [{ name: "Doorstep", chargeType: "fixed", chargeValue: 1 }],
      addressTag: { name: "Condo", chargeType: "percent", chargeValue: 5 },
      planPrice: 100,
    });
    expect(r.totalDeliveryCharge).toBe(8);
    expect(r.lines.map((l) => l.amount)).toEqual([2, 1, 5]);
    // "Delivery type" means pickup vs delivery; front door etc. are strategies.
    expect(r.lines[1]!.label).toBe("Delivery strategy: Doorstep");
  });

  it("adds one line per picked option, labelled by its group", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 3,
      deliveryStrategies: [
        { name: "Lobby", group: "Drop-off spot", chargeType: "fixed", chargeValue: 1.5 },
        { name: "Call on arrival", group: "Contact", chargeType: "percent", chargeValue: 1 },
        { name: "Don't ring", group: "Bell", chargeType: "none", chargeValue: 0 },
      ],
      planPrice: 50,
    });
    expect(r.totalDeliveryCharge).toBe(5);
    expect(r.deliveryStrategies.map((s) => s.amount)).toEqual([1.5, 0.5, 0]);
    expect(r.lines.map((l) => l.label)).toEqual([
      "Base delivery charge",
      "Drop-off spot: Lobby",
      "Contact: Call on arrival (1%)",
    ]);
  });

  it("treats 'none' as zero and omits zero lines", () => {
    const r = calculateDeliveryCharge({
      baseCharge: 0,
      deliveryStrategies: [{ name: "Standard", chargeType: "none", chargeValue: 9 }],
      planPrice: 100,
    });
    expect(r.totalDeliveryCharge).toBe(0);
    expect(r.deliveryStrategies[0]?.amount).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it("clamps negatives and handles missing rules", () => {
    const r = calculateDeliveryCharge({
      baseCharge: -5,
      deliveryStrategies: [{ name: "Bad", chargeType: "fixed", chargeValue: -10 }],
      addressTag: null,
      planPrice: 50,
    });
    expect(r.baseAmount).toBe(0);
    expect(r.totalDeliveryCharge).toBe(0);
    expect(r.addressTag).toBeNull();
    expect(calculateDeliveryCharge({ baseCharge: 1, planPrice: 10 }).deliveryStrategies).toEqual([]);
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
