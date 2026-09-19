import { describe, expect, it } from "vitest";
import {
  formatMajorAmount,
  isDuplicateProviderEvent,
  paymentCredit,
  refundDebit,
  toMinorUnits,
} from "../ledger";

describe("formatMajorAmount", () => {
  it("rounds to two decimal places", () => {
    expect(formatMajorAmount(68)).toBe("68.00");
    expect(formatMajorAmount(1.005)).toBe("1.01");
  });
});

describe("toMinorUnits", () => {
  it("uses 100x for CAD/SGD and 1x for JPY", () => {
    expect(toMinorUnits(68.5, "CAD")).toBe(6850);
    expect(toMinorUnits(68.5, "SGD")).toBe(6850);
    expect(toMinorUnits(1200, "JPY")).toBe(1200);
  });
});

describe("ledger writes", () => {
  it("credits a payment against a booking reference", () => {
    expect(paymentCredit(68, "CAD", "bkg_abc", "evt_1")).toEqual({
      direction: "credit",
      type: "payment",
      amount: "68.00",
      currency: "CAD",
      reference: "bkg_abc",
      providerEventId: "evt_1",
    });
  });

  it("debits a refund", () => {
    expect(refundDebit(10, "CAD", "bkg_abc").type).toBe("refund");
    expect(refundDebit(10, "CAD", "bkg_abc").direction).toBe("debit");
  });
});

describe("isDuplicateProviderEvent", () => {
  it("is true only when an event id is already stored", () => {
    expect(isDuplicateProviderEvent("evt_1")).toBe(true);
    expect(isDuplicateProviderEvent(null)).toBe(false);
    expect(isDuplicateProviderEvent(undefined)).toBe(false);
  });
});
