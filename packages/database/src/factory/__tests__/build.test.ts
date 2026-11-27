import { describe, expect, expectTypeOf, it } from "vitest";
import { sql } from "drizzle-orm";
import { getTableConfig as sqliteCfg } from "drizzle-orm/sqlite-core";
import { getTableConfig as pgCfg } from "drizzle-orm/pg-core";
import { getTableConfig as myCfg } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/libsql";
import { buildTables, c, check, defineTable, index, unique } from "../index";

const org = defineTable("org", { ...c.updatable("org"), name: c.string("name", 100).notNull() });

const everything = defineTable(
  "everything",
  {
    ...c.updatable("evt"),
    orgId: c.ref("org_id").notNull().references(() => org.columns.id, { onDelete: "cascade" }),
    title: c.string("title").notNull(),
    body: c.text("body"),
    qty: c.int("qty").notNull().default(0),
    done: c.bool("done").notNull().default(false),
    at: c.time("at"),
    seenAt: c.timestamp("seen_at"),
    meta: c.json<{ a: number }>("meta"),
    slug: c.string("slug"),
  },
  (t) => [
    index("evt_org_idx").on(t.orgId, t.title),
    unique("evt_slug_uq").on(t.slug).whereNotNull(t.slug),
    check("evt_qty_ck", (x) => sql`${x.qty} >= 0`),
  ],
);

const defs = { org, everything };

describe("buildTables", () => {
  it("sqlite", () => {
    const t = buildTables(defs, "sqlite").everything;
    const cfg = sqliteCfg(t);
    expect(cfg.columns.map((x) => [x.name, x.getSQLType(), x.notNull])).toMatchSnapshot();
    expect(cfg.indexes.map((i) => [i.config.name, i.config.unique, !!i.config.where])).toMatchSnapshot();
    expect(cfg.checks.map((x) => x.name)).toEqual(["evt_qty_ck"]);
    expect(cfg.foreignKeys).toHaveLength(1);
  });
  it("pg", () => {
    const cfg = pgCfg(buildTables(defs, "pg").everything);
    expect(cfg.columns.map((x) => [x.name, x.getSQLType(), x.notNull])).toMatchSnapshot();
    expect(cfg.indexes.map((i) => [i.config.name, i.config.unique, !!i.config.where])).toMatchSnapshot();
    expect(cfg.checks).toHaveLength(1);
    expect(cfg.foreignKeys).toHaveLength(1);
  });
  it("mysql", () => {
    const cfg = myCfg(buildTables(defs, "mysql").everything);
    expect(cfg.columns.map((x) => [x.name, x.getSQLType(), x.notNull])).toMatchSnapshot();
    expect(cfg.indexes.map((i) => [i.config.name, i.config.unique])).toMatchSnapshot();
    expect(cfg.checks).toHaveLength(1);
    expect(cfg.foreignKeys).toHaveLength(1);
  });

  it("index on c.text throws", () => {
    expect(() => defineTable("x", { id: c.id("xxx"), b: c.text("b") }, (t) => [index("i").on(t.b)])).toThrow(/c\.text/);
  });
  it("bad id prefix throws", () => {
    expect(() => c.id("AB")).toThrow();
    expect(() => c.base("abcd")).toThrow();
  });
  it("mysql partial index other than IS NOT NULL throws", () => {
    const d = defineTable("p", { id: c.id("ppp"), a: c.string("a") }, (t) => [
      unique("p_uq").on(t.a).where((x) => sql`${x.a} <> 'z'`),
    ]);
    expect(() => buildTables({ d }, "mysql")).toThrow(/IS NOT NULL/);
    expect(() => buildTables({ d }, "pg")).not.toThrow();
    expect(() => buildTables({ d }, "sqlite")).not.toThrow();
  });

  it("c.time is number and c.timestamp is Date at the type level", () => {
    const t = buildTables(defs, "sqlite").everything;
    type Row = typeof t.$inferSelect;
    expectTypeOf<Row["at"]>().toEqualTypeOf<number | null>();
    expectTypeOf<Row["seenAt"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<Row["createdAt"]>().toEqualTypeOf<number>();
    expectTypeOf<Row["meta"]>().toEqualTypeOf<{ a: number } | null>();
    expectTypeOf<Row["id"]>().toEqualTypeOf<string>();
    type Ins = typeof t.$inferInsert;
    expectTypeOf<Ins["title"]>().toEqualTypeOf<string>();
    expectTypeOf<Ins["id"]>().toEqualTypeOf<string | undefined>();
  });

  it("select infers columns on sqlite and runs", async () => {
    const t = buildTables(defs, "sqlite");
    const db = drizzle({ connection: { url: ":memory:" } });
    await db.run(sql`create table org (id text primary key, created_at integer not null, created_by text, updated_at integer not null, updated_by text, name text not null)`);
    await db.insert(t.org).values({ name: "a" });
    const rows = await db.select({ n: t.org.name, id: t.org.id }).from(t.org);
    expectTypeOf(rows[0].n).toEqualTypeOf<string>();
    expect(rows[0].id).toMatch(/^org_[0-9A-Za-z_-]{12}$/);
  });
});
