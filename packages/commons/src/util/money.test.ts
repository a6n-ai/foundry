import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats CAD with grouping + 2 decimals", () => {
    expect(formatMoney(1234.5)).toContain("1,234.50");
  });
  it("respects a currency + locale override", () => {
    expect(formatMoney(10, "USD", "en-US")).toBe("$10.00");
  });
});

describe("coinsFor", () => {
  it("floors with an epsilon", async () => {
    const { coinsFor } = await import("./money");
    expect(coinsFor(0.3, 0.1)).toBe(3);
    expect(coinsFor(0.29, 0.1)).toBe(2);
  });
});
