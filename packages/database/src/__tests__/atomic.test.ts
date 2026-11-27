import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { atomic, sqlNewId } from "../atomic";

let db: ReturnType<typeof drizzle>;

const ids = async (table: string) =>
  (await db.all<{ id: string }>(sql.raw(`select id from ${table} order by id`))).map((r) => r.id);

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }));
  await db.run(sql`create table t (id text primary key, v int)`);
  await db.run(sql`create table log (id text primary key, ref text)`);
  await db.run(sql`insert into t (id, v) values ('a', 1)`);
});

describe("atomic (sqlite)", () => {
  it("all items commit together", async () => {
    await atomic(db, () => [
      sql`insert into t (id, v) values ('b', 2)`,
      sql`insert into log (id, ref) values ('l1', 'b')`,
    ]);
    expect(await ids("t")).toEqual(["a", "b"]);
    expect(await ids("log")).toEqual(["l1"]);
  });

  it("a failing item rolls back the unit", async () => {
    await expect(
      atomic(db, () => [
        sql`insert into t (id, v) values ('b', 2)`,
        sql`insert into t (id, v) values ('a', 3)`,
      ]),
    ).rejects.toThrow();
    expect(await ids("t")).toEqual(["a"]);
  });

  const guarded = {
    query: sql`insert into log (id, ref) select 'l1', id from t where id = 'a'`,
    onlyIfPreviousChanged: 1 as const,
  };

  it("guarded insert skipped when previous update matched 0 rows", async () => {
    await atomic(db, () => [sql`update t set v = 9 where id = 'zzz'`, guarded]);
    expect(await ids("log")).toEqual([]);
  });

  it("guarded insert runs when previous update matched 1 row", async () => {
    await atomic(db, () => [sql`update t set v = 9 where id = 'a'`, guarded]);
    expect(await ids("log")).toEqual(["l1"]);
  });

  it("guarded non-INSERT…SELECT item throws", async () => {
    await expect(
      atomic(db, () => [
        sql`update t set v = 9 where id = 'a'`,
        { query: sql`insert into log (id, ref) values ('l1', 'a')`, onlyIfPreviousChanged: 1 },
      ]),
    ).rejects.toThrow(/INSERT/);
  });
});

describe("sqlNewId", () => {
  it("sqlite yields prefix + 12 hex", async () => {
    const [row] = await db.all<{ id: string }>(sql`select ${sqlNewId("abc", "sqlite")} as id`);
    expect(row!.id).toMatch(/^abc_[0-9a-f]{12}$/);
  });

  it("rejects a bad prefix", () => {
    expect(() => sqlNewId("ab", "pg")).toThrow(/3 lowercase/);
  });
});
