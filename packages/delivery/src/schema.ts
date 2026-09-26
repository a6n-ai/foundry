import { updatableColumns } from "@foundry/database";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgTable,
} from "drizzle-orm/pg-core";

/**
 * Delivery-charge tables, identical in every adopting app. Built per app because
 * `organization_id` FKs to that app's own organization table. The app owns the
 * `delivery_strategy_id` / `address_tag_id` columns on its orders and users.
 */
export function makeDeliveryChargeTables(deps: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization: AnyPgTable & { id: any };
}) {
  const { organization } = deps;
  const deliveryChargeType = pgEnum("delivery_charge_type", ["none", "fixed", "percent"]);

  const deliveryChargeConfigs = pgTable(
    "delivery_charge_configs",
    {
      ...updatableColumns("dcc"),
      baseCharge: numeric("base_charge", { precision: 10, scale: 2 }).notNull().default("0.00"),
      organizationId: text("organization_id").references(() => organization.id),
    },
    (t) => [index("delivery_charge_configs_org_idx").on(t.organizationId)],
  );

  // Strategies and tags share one shape: a named surcharge rule.
  const ruleColumns = () => ({
    name: text("name").notNull(),
    description: text("description"),
    chargeType: deliveryChargeType("charge_type").notNull().default("none"),
    chargeValue: numeric("charge_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    organizationId: text("organization_id").references(() => organization.id),
  });

  const deliveryStrategies = pgTable(
    "delivery_strategies",
    { ...updatableColumns("dsp"), ...ruleColumns() },
    (t) => [
      uniqueIndex("delivery_strategies_name_unique").on(t.name),
      index("delivery_strategies_active_idx").on(t.active),
      index("delivery_strategies_org_idx").on(t.organizationId),
    ],
  );

  const addressTags = pgTable(
    "address_tags",
    { ...updatableColumns("atg"), ...ruleColumns() },
    (t) => [
      uniqueIndex("address_tags_name_unique").on(t.name),
      index("address_tags_active_idx").on(t.active),
      index("address_tags_org_idx").on(t.organizationId),
    ],
  );

  return { deliveryChargeType, deliveryChargeConfigs, deliveryStrategies, addressTags };
}

export type DeliveryChargeTables = ReturnType<typeof makeDeliveryChargeTables>;
export type DeliveryChargeTypeValue = DeliveryChargeTables["deliveryChargeType"]["enumValues"][number];
