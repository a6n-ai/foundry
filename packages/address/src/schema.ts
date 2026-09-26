import { updatableColumns } from "@foundry/database";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgTable,
  type PgColumnBuilderBase,
} from "drizzle-orm/pg-core";

/**
 * Saved customer addresses, identical in every adopting app. `extraColumns` lets an app
 * attach its own fields (tiffin-grab: address_tag_id, delivery_strategy_id) without this
 * package knowing about delivery. Names are load-bearing — renaming needs a migration per app.
 */
export function makeAddressTables<X extends Record<string, PgColumnBuilderBase> = Record<string, never>>(deps: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: AnyPgTable & { id: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization: AnyPgTable & { id: any };
  extraColumns?: () => X;
}) {
  const { users, organization } = deps;

  const customerAddresses = pgTable(
    "customer_addresses",
    {
      ...updatableColumns("adr"),
      userId: bigint("user_id", { mode: "bigint" }).notNull().references(() => users.id),
      /** "Home", "Work", or the street line. Unique per user among live rows (enforced in the service). */
      label: text("label").notNull(),
      fullName: text("full_name"),
      addressLine: text("address_line").notNull(),
      addressUnit: text("address_unit"),
      city: text("city").notNull(),
      province: text("province"),
      postalCode: text("postal_code").notNull(),
      deliveryInstructions: text("delivery_instructions"),
      lat: numeric("lat", { precision: 9, scale: 6 }),
      lng: numeric("lng", { precision: 9, scale: 6 }),
      isDefault: boolean("is_default").notNull().default(false),
      /** Soft delete: hidden from lists, kept so snapshots/orders can still reference it. */
      archivedAt: bigint("archived_at", { mode: "number" }),
      organizationId: text("organization_id").references(() => organization.id),
      ...((deps.extraColumns?.() ?? {}) as X),
    },
    (t) => [
      uniqueIndex("customer_addresses_one_default")
        .on(t.userId)
        .where(sql`${t.isDefault} AND ${t.archivedAt} IS NULL`),
      index("customer_addresses_user_idx").on(t.userId),
      index("customer_addresses_org_idx").on(t.organizationId),
    ],
  );

  return { customerAddresses };
}

export type AddressTables = ReturnType<typeof makeAddressTables>;
export type CustomerAddressRow = AddressTables["customerAddresses"]["$inferSelect"];
