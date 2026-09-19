import { describe, expect, it } from "vitest";
import { getTableConfig, pgTable, text } from "drizzle-orm/pg-core";
import { makeDiscountTables } from "../schema";

const organization = pgTable("organization", { id: text("id").primaryKey() });
const { discountKind, discounts } = makeDiscountTables({ organization });
const cfg = getTableConfig(discounts);
const col = (n: string) => cfg.columns.find((c) => c.name === n)!;

describe("makeDiscountTables", () => {
  it("names table and enum, defaults kinds", () => {
    expect(cfg.name).toBe("discounts");
    expect(discountKind.enumName).toBe("discount_kind");
    expect(discountKind.enumValues).toEqual(["delivery", "duration"]);
  });

  it("has the expected columns and nullability", () => {
    for (const n of ["key", "name", "kind", "percent", "active"]) expect(col(n).notNull).toBe(true);
    for (const n of ["target_id", "starts_at", "ends_at", "min_weeks", "organization_id"])
      expect(col(n).notNull).toBe(false);
    expect(col("key").isUnique).toBe(true);
    expect(col("active").default).toBe(true);
  });

  it("keeps the percent range check and org FK", () => {
    expect(cfg.checks.map((c) => c.name)).toEqual(["discounts_percent_range"]);
    expect(cfg.foreignKeys).toHaveLength(1);
  });

  it("lets an app override kinds", () => {
    const t = makeDiscountTables({ organization, kinds: ["delivery", "duration", "loyalty"] });
    expect(t.discountKind.enumValues).toContain("loyalty");
  });
});
