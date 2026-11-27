import { describe, it, expect } from "vitest";
import { and, eq as cEq, inList, like, between, or as cOr } from "@foundry/commons/model/condition";
import { PgDialect, pgTable, bigint, text } from "drizzle-orm/pg-core";
import { SQLiteSyncDialect, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { MySqlDialect, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { conditionToSql, columnResolver } from "../condition";

const t = pgTable("t", {
  id: bigint("id", { mode: "number" }),
  name: text("name"),
  status: text("status"),
  createdAt: bigint("created_at", { mode: "number" }),
});
const resolve = columnResolver({ name: t.name, status: t.status, createdAt: t.createdAt });

const sqlOf = (c: Parameters<typeof conditionToSql>[0]) =>
  conditionToSql(c, resolve)?.queryChunks?.length ? "sql" : undefined;

describe("conditionToSql", () => {
  it("returns undefined for undefined condition", () => {
    expect(conditionToSql(undefined, resolve)).toBeUndefined();
  });
  it("builds a filter for each operator without throwing", () => {
    expect(sqlOf(cEq("status", "won"))).toBe("sql");
    expect(sqlOf(inList("status", ["won", "lost"]))).toBe("sql");
    expect(sqlOf(like("name", "%priya%"))).toBe("sql");
    expect(sqlOf(between("createdAt", 1, 2))).toBe("sql");
  });
  it("skips empty in-lists and empty complex nodes", () => {
    expect(conditionToSql(inList("status", []), resolve)).toBeUndefined();
    expect(conditionToSql(and(), resolve)).toBeUndefined();
    expect(conditionToSql(and(inList("status", [])), resolve)).toBeUndefined();
  });
  it("combines and/or", () => {
    const c = and(cEq("status", "won"), cOr(like("name", "%a%"), like("name", "%b%")));
    expect(sqlOf(c)).toBe("sql");
  });
  it("unknown field throws via resolver", () => {
    expect(() => conditionToSql(cEq("nope", "x"), resolve)).toThrow();
  });
});

describe("columnResolver dialects", () => {
  it("default dialect is pg", () => {
    const q = new PgDialect().sqlToQuery(conditionToSql(like("name", "%a%"), resolve)!);
    expect(q.sql).toContain("ilike");
  });
  it("like compiles to like on sqlite", () => {
    const st = sqliteTable("t", { name: sqliteText("name") });
    const r = columnResolver({ name: st.name }, "sqlite");
    const q = new SQLiteSyncDialect().sqlToQuery(conditionToSql(like("name", "%a%"), r)!);
    expect(q.sql).toContain(" like ");
    expect(q.sql).not.toContain("ilike");
  });
  it("like compiles to like on mysql", () => {
    const mt = mysqlTable("t", { name: varchar("name", { length: 64 }) });
    const r = columnResolver({ name: mt.name }, "mysql");
    const q = new MySqlDialect().sqlToQuery(conditionToSql(like("name", "%a%"), r)!);
    expect(q.sql).toContain(" like ");
    expect(q.sql).not.toContain("ilike");
  });
});
