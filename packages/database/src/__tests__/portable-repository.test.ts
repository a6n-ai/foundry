/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, between, eq as cEq, gt, gte, inList, like, lt, lte, or } from "@foundry/commons/model/condition";
import { eq, sql } from "drizzle-orm";
import { bigint, pgTable, text } from "drizzle-orm/pg-core";
import { atomic, sqlNewId, UpdatableRepository } from "../index";
import { c, defineTable, buildTables } from "../factory";
import { connectLibsql } from "../drivers/libsql";
import { connectPostgres } from "../drivers/postgres";
import { connectMysql } from "../drivers/mysql";
import type { Dialect } from "../types";

const defs = {
  deals: defineTable("deals", {
    ...c.updatable("del"),
    name: c.string("name").notNull(),
    amount: c.int("amount"),
    status: c.string("status"),
  }),
  dealLog: defineTable("deal_log", { id: c.id("log") }),
};

const cases: { dialect: Dialect; url: string | undefined; envVar?: string }[] = [
  { dialect: "sqlite", url: "file::memory:" },
  { dialect: "pg", url: process.env.PORTABLE_PG_URL, envVar: "PORTABLE_PG_URL" },
  { dialect: "mysql", url: process.env.PORTABLE_MYSQL_URL, envVar: "PORTABLE_MYSQL_URL" },
];
for (const k of cases) {
  if (!k.url) console.warn(`portable-repository: ${k.dialect} suite skipped, ${k.envVar} is not set`);
}

const TYPES = {
  sqlite: { id: "text", str: "text", int: "integer", big: "integer" },
  pg: { id: "text", str: "varchar(255)", int: "integer", big: "bigint" },
  mysql: { id: "varchar(32)", str: "varchar(255)", int: "int", big: "bigint" },
} as const;

const ddl = (d: Dialect) => {
  const t = TYPES[d];
  return [
    `CREATE TABLE deals (id ${t.id} PRIMARY KEY, created_at ${t.big} NOT NULL, created_by ${t.id}, updated_at ${t.big} NOT NULL, updated_by ${t.id}, name ${t.str} NOT NULL, amount ${t.int}, status ${t.str})`,
    `CREATE TABLE deal_log (id ${t.id} PRIMARY KEY)`,
  ];
};
const DROPS = ["DROP TABLE IF EXISTS deals", "DROP TABLE IF EXISTS deal_log"];

const exec = (d: Dialect, db: any, text: string) => (d === "sqlite" ? db.run(sql.raw(text)) : db.execute(sql.raw(text)));
const closeDb = (d: Dialect, db: any) => (d === "sqlite" ? db.$client.close() : db.$client.end());

const SEED = [
  { id: "del_a", name: "Priya Shah", amount: 10, status: "open" },
  { id: "del_b", name: "Bob", amount: 20, status: "open" },
  { id: "del_c", name: "Carol", amount: 30, status: "won" },
  { id: "del_d", name: "Dave", amount: 40, status: "lost" },
  { id: "del_e", name: "Eve", amount: 50, status: "won" },
];

describe.each(cases)("portable repository on $dialect", ({ dialect, url }) => {
  describe.skipIf(!url)("suite", () => {
    let db: any;
    let repo: UpdatableRepository<any, any, string>;
    let tables: any;
    const ids = (r: { items: { id: string }[] }) => r.items.map((i) => i.id);

    beforeAll(async () => {
      tables = buildTables(defs, dialect);
      const schema = { ...tables };
      db = dialect === "sqlite" ? connectLibsql(url!, schema) : dialect === "pg" ? connectPostgres(url!, schema) : connectMysql(url!, schema);
      for (const s of DROPS) await exec(dialect, db, s);
      for (const s of ddl(dialect)) await exec(dialect, db, s);
      repo = new UpdatableRepository<any, any, string>(db, tables.deals, tables.deals.id, tables.deals.id);
      for (const row of SEED) await repo.create(row);
    });
    afterAll(async () => {
      for (const s of DROPS) await exec(dialect, db, s);
      await closeDb(dialect, db);
    });

    it("create returns a row and generates a prefixed id", async () => {
      const row = await repo.create({ name: "Zed", amount: 1 });
      expect(row.id).toMatch(/^del_/);
      expect(row.name).toBe("Zed");
      expect(typeof row.createdAt).toBe("number");
      expect(await repo.deleteByPublicId(row.id)).toBe(1);
    });

    it("finds by id and by publicId", async () => {
      expect((await repo.findByPublicId("del_b"))?.name).toBe("Bob");
      expect((await repo.findById("del_b"))?.name).toBe("Bob");
      expect(await repo.findByPublicId("del_nope")).toBeNull();
    });

    it("findMany supports every operator", async () => {
      const q = async (cond: any) => ids(await repo.findMany(cond, { page: 0, size: 50, sort: { field: "id", dir: "asc" } }));
      expect(await q(cEq("status", "won"))).toEqual(["del_c", "del_e"]);
      expect(await q(inList("status", ["lost", "won"]))).toEqual(["del_c", "del_d", "del_e"]);
      expect(await q(like("name", "%ob%"))).toEqual(["del_b"]);
      expect(await q(gt("amount", 30))).toEqual(["del_d", "del_e"]);
      expect(await q(gte("amount", 30))).toEqual(["del_c", "del_d", "del_e"]);
      expect(await q(lt("amount", 20))).toEqual(["del_a"]);
      expect(await q(lte("amount", 20))).toEqual(["del_a", "del_b"]);
      expect(await q(between("amount", 20, 40))).toEqual(["del_b", "del_c", "del_d"]);
      expect(await q(and(cEq("status", "open"), or(gt("amount", 15), like("name", "%priya%"))))).toEqual(["del_a", "del_b"]);
      expect(await q(undefined)).toHaveLength(5);
    });

    it("findMany pages and sorts", async () => {
      const r = await repo.findMany(undefined, { page: 1, size: 2, sort: { field: "amount", dir: "desc" } });
      expect(r.total).toBe(5);
      expect(r.page).toBe(1);
      expect(r.size).toBe(2);
      expect(r.items.map((i: any) => i.amount)).toEqual([30, 20]);
    });

    it("like is ASCII case-insensitive", async () => {
      const r = await repo.findMany(like("name", "%PRIYA%"));
      expect(ids(r)).toEqual(["del_a"]);
    });

    it("updates by publicId", async () => {
      const row = await repo.updateByPublicId("del_b", { status: "won" });
      expect(row?.status).toBe("won");
      expect((await repo.findByPublicId("del_b"))?.status).toBe("won");
      await repo.updateByPublicId("del_b", { status: "open" });
      expect(await repo.updateByPublicId("del_nope", { status: "x" })).toBeNull();
    });

    it("hard deletes", async () => {
      await repo.create({ id: "del_x", name: "Temp" });
      expect(await repo.deleteByPublicId("del_x")).toBe(1);
      expect(await repo.findByPublicId("del_x")).toBeNull();
      expect(await repo.deleteByPublicId("del_x")).toBe(0);
    });

    it("string TActorId is stored on create and update", async () => {
      const row = await repo.create({ id: "del_y", name: "Actor" }, "usr_1");
      expect(row.createdBy).toBe("usr_1");
      const upd = await repo.updateByPublicId("del_y", { name: "Actor2" }, "usr_2");
      expect(upd?.updatedBy).toBe("usr_2");
      expect(upd?.createdBy).toBe("usr_1");
      await repo.deleteByPublicId("del_y");
    });

    const countLog = async () => {
      const rows: any = await db.select({ id: tables.dealLog.id }).from(tables.dealLog);
      return rows.length;
    };

    it("atomic runs a guarded item when the previous statement changed one row", async () => {
      const before = await countLog();
      await atomic(db, (q: any) => [
        q.update(tables.deals).set({ status: "won" }).where(eq(tables.deals.id, "del_a")),
        { query: sql`insert into deal_log (id) select ${sqlNewId("log", dialect)}`, onlyIfPreviousChanged: 1 as const },
      ]);
      expect(await countLog()).toBe(before + 1);
      await repo.updateByPublicId("del_a", { status: "open" });
    });

    it("atomic skips a guarded item when the previous statement changed nothing", async () => {
      const before = await countLog();
      await atomic(db, (q: any) => [
        q.update(tables.deals).set({ status: "won" }).where(eq(tables.deals.id, "del_missing")),
        { query: sql`insert into deal_log (id) select ${sqlNewId("log", dialect)}`, onlyIfPreviousChanged: 1 as const },
      ]);
      expect(await countLog()).toBe(before);
    });

    it("atomic rolls back every item when one fails", async () => {
      await expect(
        atomic(db, (q: any) => [
          q.insert(tables.deals).values({ id: "del_rb", name: "Rollback" }),
          q.insert(tables.deals).values({ id: "del_a", name: "Duplicate pk" }),
        ]),
      ).rejects.toThrow();
      expect(await repo.findByPublicId("del_rb")).toBeNull();
    });
  });
});

const pgUrl = process.env.PORTABLE_PG_URL;

describe.skipIf(!pgUrl)("pg-builder repository regression (live pg, bigint ids)", () => {
  const items = pgTable("items", {
    id: bigint("id", { mode: "bigint" }).primaryKey().default(sql`next_id()`),
    publicId: text("public_id").notNull().unique(),
    appId: bigint("app_id", { mode: "bigint" }).notNull().default(sql`current_app_id()`),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    createdBy: bigint("created_by", { mode: "bigint" }),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    updatedBy: bigint("updated_by", { mode: "bigint" }),
  });
  let db: any;
  let repo: UpdatableRepository<typeof items, any, bigint>;

  beforeAll(async () => {
    db = connectPostgres(pgUrl!, { items });
    for (const s of [
      "DROP TABLE IF EXISTS items",
      "DROP SEQUENCE IF EXISTS portable_id_seq",
      "CREATE SEQUENCE portable_id_seq",
      "CREATE OR REPLACE FUNCTION next_id() RETURNS bigint LANGUAGE sql AS $$ SELECT nextval('portable_id_seq') $$",
      "CREATE OR REPLACE FUNCTION current_app_id() RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$",
      `CREATE TABLE items (id bigint PRIMARY KEY DEFAULT next_id(), public_id text NOT NULL UNIQUE, app_id bigint NOT NULL DEFAULT current_app_id(), created_at bigint NOT NULL, created_by bigint, updated_at bigint NOT NULL, updated_by bigint)`,
    ]) {
      await db.execute(sql.raw(s));
    }
    repo = new UpdatableRepository(db, items, items.publicId, items.id);
  });
  afterAll(async () => {
    await db.execute(sql.raw("DROP TABLE IF EXISTS items"));
    await db.$client.end();
  });

  it("create, find, update, delete with bigint ids and actors", async () => {
    const row = await repo.create({ publicId: "itm_1", createdAt: 1, updatedAt: 1 }, 7n);
    expect(row.publicId).toBe("itm_1");
    expect(typeof row.id).toBe("bigint");
    expect(row.appId).toBe(1n);
    expect(row.createdBy).toBe(7n);
    expect((await repo.findById(row.id))?.publicId).toBe("itm_1");
    const upd = await repo.updateByPublicId("itm_1", { updatedAt: 2 }, 8n);
    expect(upd?.updatedBy).toBe(8n);
    const page = await repo.findMany(like("publicId", "%ITM%"), { page: 0, size: 10, sort: { field: "createdAt", dir: "desc" } });
    expect(page.total).toBe(1);
    expect(await repo.deleteByPublicId("itm_1")).toBe(1);
  });
});
