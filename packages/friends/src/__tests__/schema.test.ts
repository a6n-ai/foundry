import { describe, expect, it } from "vitest";
import { bigint, getTableConfig, pgTable } from "drizzle-orm/pg-core";
import { makeFriendTables } from "../schema";

const users = pgTable("users", { id: bigint("id", { mode: "bigint" }).primaryKey() });

describe("makeFriendTables", () => {
  it("has one row per pair, an inbox index and no self-friendship", () => {
    const cfg = getTableConfig(makeFriendTables({ users }).friendships);
    expect(cfg.name).toBe("friendships");
    const pair = cfg.indexes.find((i) => i.config.name === "friendships_pair_idx");
    expect(pair?.config.unique).toBe(true);
    expect(cfg.indexes.map((i) => i.config.name)).toContain("friendships_addressee_idx");
    expect(cfg.checks.map((c) => c.name)).toContain("friendships_not_self");
  });
});
