import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats CAD with grouping + 2 decimals", () => {
    expect(formatMoney(1234.5)).toContain("1,234.50");
  });
  it("defaults to CAD without a currency", () => {
    expect(formatMoney(1)).toBe("$1.00");
  });
  it("uses Indian grouping for INR", () => {
    expect(formatMoney(1234567.5, "INR")).toBe("\u20B912,34,567.50");
  });
  it("whole drops decimals", () => {
    expect(formatMoney(1234.5, "CAD", { whole: true })).toBe("$1,235");
  });
  it("narrow shows a bare symbol", () => {
    expect(formatMoney(5, "USD", { narrow: true })).toBe("$5.00");
  });
});

describe("coinsFor", () => {
  it("floors with an epsilon", async () => {
    const { coinsFor } = await import("./money");
    expect(coinsFor(0.3, 0.1)).toBe(3);
    expect(coinsFor(0.29, 0.1)).toBe(2);
  });
});
