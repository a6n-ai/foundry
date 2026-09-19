import { updatableColumns } from "@foundry/database";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  type AnyPgTable,
} from "drizzle-orm/pg-core";

/**
 * Central catalog-discount table, identical in every adopting app. Applicable
 * rows ADD UP (the app caps the sum). Built per app because `organization_id`
 * FKs to that app's own organization table, and `kinds` lets an app extend the
 * enum (same Postgres type name, different value set — like makeWalletTables).
 * `target_id` is a soft ref (no FK); null = every row of that kind.
 */
export function makeDiscountTables<
  K extends [string, ...string[]] = ["delivery", "duration"],
>(deps: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization: AnyPgTable & { id: any };
  kinds?: K;
}) {
  const { organization } = deps;
  const kinds = (deps.kinds ?? ["delivery", "duration"]) as K;
  const discountKind = pgEnum("discount_kind", kinds);

  const discounts = pgTable(
    "discounts",
    {
      ...updatableColumns("dsc"),
      key: text("key").notNull().unique(),
      name: text("name").notNull(),
      kind: discountKind("kind").notNull(),
      targetId: bigint("target_id", { mode: "bigint" }),
      percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
      active: boolean("active").notNull().default(true),
      startsAt: bigint("starts_at", { mode: "number" }),
      endsAt: bigint("ends_at", { mode: "number" }),
      minWeeks: integer("min_weeks"),
      organizationId: text("organization_id").references(() => organization.id),
    },
    (t) => [check("discounts_percent_range", sql`${t.percent} >= 0 AND ${t.percent} <= 100`)],
  );

  return { discountKind, discounts };
}

type Tables = ReturnType<typeof makeDiscountTables>;
export type DiscountRow = Tables["discounts"]["$inferSelect"];
export type NewDiscountRow = Tables["discounts"]["$inferInsert"];
