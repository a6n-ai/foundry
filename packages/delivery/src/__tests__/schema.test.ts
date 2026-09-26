import { describe, expect, it } from "vitest";
import { getTableConfig, pgTable, text } from "drizzle-orm/pg-core";
import { makeDeliveryChargeTables } from "../schema";

const organization = pgTable("organization", { id: text("id").primaryKey() });
const t = makeDeliveryChargeTables({ organization });

// Names are load-bearing: adopting apps already have these tables, so a rename
// here would need a migration in every app.
describe("makeDeliveryChargeTables", () => {
  it("keeps table, enum and index names stable", () => {
    expect(t.deliveryChargeType.enumName).toBe("delivery_charge_type");
    expect(t.deliveryChargeType.enumValues).toEqual(["none", "fixed", "percent"]);
    expect(getTableConfig(t.deliveryChargeConfigs).name).toBe("delivery_charge_configs");

    for (const [table, name] of [
      [t.deliveryStrategies, "delivery_strategies"],
      [t.addressTags, "address_tags"],
    ] as const) {
      const cfg = getTableConfig(table);
      expect(cfg.name).toBe(name);
      expect(cfg.indexes.map((i) => i.config.name).sort()).toEqual(
        [`${name}_active_idx`, `${name}_name_unique`, `${name}_org_idx`],
      );
      expect(cfg.columns.map((c) => c.name)).toEqual(
        expect.arrayContaining(["name", "charge_type", "charge_value", "active", "sort_order", "organization_id"]),
      );
    }
  });
});
