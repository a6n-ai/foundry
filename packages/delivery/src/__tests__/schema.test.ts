import { describe, expect, it } from "vitest";
import { getTableConfig, pgTable, text } from "drizzle-orm/pg-core";
import { makeDeliveryTables } from "../schema";

const organization = pgTable("organization", { id: text("id").primaryKey() });
const t = makeDeliveryTables({ organization });

// Names are load-bearing: adopting apps already have these tables, so a rename
// here would need a migration in every app.
describe("makeDeliveryTables", () => {
  it("keeps table, enum and index names stable", () => {
    expect(t.deliveryChargeType.enumName).toBe("delivery_charge_type");
    expect(t.deliveryChargeType.enumValues).toEqual(["none", "fixed", "percent"]);
    expect(getTableConfig(t.deliveryChargeConfigs).name).toBe("delivery_charge_configs");
    expect(getTableConfig(t.deliveryZones).name).toBe("delivery_zones");
    expect(getTableConfig(t.deliveryZones).checks.map((c) => c.name)).toEqual(["delivery_zones_shape_check"]);
    expect(getTableConfig(t.deliveryTypes).name).toBe("delivery_types");
    expect(getTableConfig(t.deliveryZoneTypes).indexes.map((i) => i.config.name)).toEqual(["delivery_zone_types_zone_type_unique", "delivery_zone_types_type_idx"]);

    expect(getTableConfig(t.deliveryStrategyGroups).name).toBe("delivery_strategy_groups");
    expect(getTableConfig(t.deliveryStrategyGroups).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["name", "active", "sort_order", "organization_id"]),
    );
    expect(getTableConfig(t.deliveryStrategyConnections).name).toBe("delivery_strategy_connections");
    expect(getTableConfig(t.deliveryStrategies).indexes.map((i) => i.config.name).sort()).toEqual([
      "delivery_strategies_active_idx",
      "delivery_strategies_connection_idx",
      "delivery_strategies_group_idx",
      "delivery_strategies_group_name_unique",
      "delivery_strategies_org_idx",
    ]);
    expect(getTableConfig(t.deliveryStrategies).columns.map((c) => c.name)).toEqual(expect.arrayContaining(["group_id", "connection_id", "charge_basis"]));
    expect(getTableConfig(t.addressTags).indexes.map((i) => i.config.name).sort()).toEqual(
      ["address_tags_active_idx", "address_tags_name_unique", "address_tags_org_idx"],
    );

    for (const [table, name] of [
      [t.deliveryStrategies, "delivery_strategies"],
      [t.addressTags, "address_tags"],
    ] as const) {
      const cfg = getTableConfig(table);
      expect(cfg.name).toBe(name);
      expect(cfg.columns.map((c) => c.name)).toEqual(
        expect.arrayContaining(["name", "charge_type", "charge_value", "active", "sort_order", "organization_id"]),
      );
    }
  });
});
