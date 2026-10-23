import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { calculateTax } from "../tax";

describe("calculateTax", () => {
  it("maps the breakdown to lines", async () => {
    const s = { tax: { calculations: { create: vi.fn(async () => ({
      id: "taxcalc_1", amount_total: 22600, tax_amount_exclusive: 2600, expires_at: 1791000000,
      tax_breakdown: [{ amount: 2600, taxability_reason: "standard_rated", tax_rate_details: { tax_type: "hst", percentage_decimal: "13.0", state: "ON" } }],
    })) } } } as unknown as Stripe;
    const q = await calculateTax(s, { amountCents: 20000, taxCode: "txcd_x", reference: "ord_1", address: { line1: "1 A", postalCode: "M5H 2N2", province: "ON" } });
    expect(q).toEqual({ calculationId: "taxcalc_1", taxCents: 2600, totalCents: 22600, expiresAt: 1791000000_000, lines: [{ label: "HST", ratePct: 13, amountCents: 2600 }], reasons: ["standard_rated"] });
    const params = (s.tax.calculations.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(params.customer_details.address).toMatchObject({ country: "CA", postal_code: "M5H 2N2", state: "ON" });
    expect(params.line_items[0]).toMatchObject({ amount: 20000, tax_code: "txcd_x", tax_behavior: "exclusive", reference: "ord_1" });
  });

  it("times out", async () => {
    const s = { tax: { calculations: { create: () => new Promise(() => {}) } } } as unknown as Stripe;
    await expect(calculateTax(s, { amountCents: 1, taxCode: "t", reference: "r", address: { line1: "x", postalCode: "y" } }, 20)).rejects.toThrow(/timed out/);
  });
});
