import { baseColumns } from "@foundry/database";
import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, uniqueIndex, type AnyPgTable } from "drizzle-orm/pg-core";

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

/**
 * One row per pair of customers, whoever asked first. Built per app because it
 * FKs that app's `users`, the same way `makeWalletTables` works, so drizzle-kit
 * generates each app's own migration.
 *
 * The pair index is on (least, greatest) so A→B and B→A collide: two people
 * asking each other at the same moment cannot end up with two rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeFriendTables(deps: { users: AnyPgTable & { id: any } }) {
  const userId = () => deps.users.id;
  const friendships = pgTable(
    "friendships",
    {
      ...baseColumns("frn"),
      requesterId: bigint("requester_id", { mode: "bigint" }).notNull().references(userId),
      addresseeId: bigint("addressee_id", { mode: "bigint" }).notNull().references(userId),
      status: text("status", { enum: FRIENDSHIP_STATUSES }).notNull().default("pending"),
      acceptedAt: bigint("accepted_at", { mode: "number" }),
    },
    (t) => [
      uniqueIndex("friendships_pair_idx").on(
        sql`least(${t.requesterId}, ${t.addresseeId})`,
        sql`greatest(${t.requesterId}, ${t.addresseeId})`,
      ),
      index("friendships_addressee_idx").on(t.addresseeId, t.status),
      index("friendships_requester_idx").on(t.requesterId, t.status),
      check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
    ],
  );
  return { friendships };
}
