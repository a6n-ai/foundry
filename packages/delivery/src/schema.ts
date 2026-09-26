import { updatableColumns } from "@foundry/database";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
 * Every delivery table, identical in each adopting app. Built per app because
 * `organization_id` FKs to that app's own organization table. Apps own the columns
 * that point here from their orders/users (`delivery_zone_id`, `delivery_strategy_id`…).
 * Names are load-bearing: renaming one needs a migration in every app.
 */
export function makeDeliveryTables(deps: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization: AnyPgTable & { id: any };
}) {
  const { organization } = deps;
  const orgId = () => text("organization_id").references(() => organization.id);

  // ── Zones: where we deliver ────────────────────────────────────────────────
  const deliveryZones = pgTable(
    "delivery_zones",
    {
      ...updatableColumns("zon"),
      name: text("name").notNull(),
      /** Circle zone: km from the store. Null for a postal zone. */
      radiusKm: numeric("radius_km", { precision: 6, scale: 2 }),
      /** Postal zone: FSA-style prefixes, longest match wins. Empty for a circle zone. */
      postalPrefixes: text("postal_prefixes").array().notNull().default(sql`'{}'::text[]`),
      slotWindow: text("slot_window"),
      // Soft delete: historical orders keep a resolvable zone.
      active: boolean("active").notNull().default(true),
      organizationId: orgId(),
    },
    (t) => [
      check(
        "delivery_zones_shape_check",
        sql`(${t.radiusKm} IS NULL) <> (cardinality(${t.postalPrefixes}) = 0)`,
      ),
    ],
  );

  // ── Types: how an order is fulfilled (pickup, instant, scheduled…) ─────────
  const deliveryTypes = pgTable("delivery_types", {
    ...updatableColumns("dty"),
    /** Stable machine key, set once at creation — orders reference it. */
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    requiresAddress: boolean("requires_address").notNull().default(true),
    requiresSchedule: boolean("requires_schedule").notNull().default(false),
    minSubtotal: numeric("min_subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    organizationId: orgId(),
  });

  /** Which types a zone offers. No rows for a zone = it offers every active type. */
  const deliveryZoneTypes = pgTable(
    "delivery_zone_types",
    {
      ...updatableColumns("dzt"),
      zoneId: bigint("zone_id", { mode: "bigint" }).notNull().references(() => deliveryZones.id),
      typeId: bigint("type_id", { mode: "bigint" }).notNull().references(() => deliveryTypes.id),
    },
    (t) => [
      uniqueIndex("delivery_zone_types_zone_type_unique").on(t.zoneId, t.typeId),
      index("delivery_zone_types_type_idx").on(t.typeId),
    ],
  );

  // ── Charges: surcharges on top of the order ────────────────────────────────
  const deliveryChargeType = pgEnum("delivery_charge_type", ["none", "fixed", "percent"]);

  /** One row per org: base fee, plus the store origin circles are measured from. */
  const deliveryChargeConfigs = pgTable(
    "delivery_charge_configs",
    {
      ...updatableColumns("dcc"),
      baseCharge: numeric("base_charge", { precision: 10, scale: 2 }).notNull().default("0.00"),
      storeLat: numeric("store_lat", { precision: 9, scale: 6 }),
      storeLng: numeric("store_lng", { precision: 9, scale: 6 }),
      organizationId: orgId(),
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
    organizationId: orgId(),
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

  return {
    deliveryZones,
    deliveryTypes,
    deliveryZoneTypes,
    deliveryChargeType,
    deliveryChargeConfigs,
    deliveryStrategies,
    addressTags,
  };
}

export type DeliveryTables = ReturnType<typeof makeDeliveryTables>;
export type DeliveryChargeTypeValue = DeliveryTables["deliveryChargeType"]["enumValues"][number];
