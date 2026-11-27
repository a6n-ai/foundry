import { createClient } from "@libsql/client";
import { entityKind, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { atomic, readAffected, sqlNewId } from "../atomic";

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

  it("guarded insert with a bound param in the SELECT", async () => {
    await atomic(db, () => [
      sql`update t set v = 9 where id = 'a'`,
      { query: sql`insert into log (id, ref) select 'l1', id from t where id = ${"a"}`, onlyIfPreviousChanged: 1 },
    ]);
    expect(await ids("log")).toEqual(["l1"]);
  });

  it.each(["on conflict do nothing", "returning id"])("guarded item with %s throws", async (tail) => {
    await expect(
      atomic(db, () => [
        sql`update t set v = 9 where id = 'a'`,
        { query: sql.raw(`insert into log (id, ref) select 'l1', id from t ${tail}`), onlyIfPreviousChanged: 1 },
      ]),
    ).rejects.toThrow(/without ON CONFLICT\/RETURNING/);
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

describe("atomic (pg/mysql path, fake tx)", () => {
  const fakeDb = (dialect: string, results: unknown[]) => {
    const ran: unknown[] = [];
    class Fake {
      static readonly [entityKind] = dialect;
      transaction<T>(cb: (tx: unknown) => Promise<T>) {
        return cb({ execute: async (q: unknown) => (ran.push(q), results[ran.length - 1]) });
      }
    }
    return { db: new Fake() as never, ran };
  };
  const guarded = { query: sql`insert into log select 1`, onlyIfPreviousChanged: 1 as const };
  const upd = sql`update t set v = 1`;

  it("pg runs guarded item when count is 1", async () => {
    const { db, ran } = fakeDb("PgDatabase", [{ count: 1 }, { count: 1 }]);
    expect(await atomic(db, () => [upd, guarded])).toEqual([{ count: 1 }, { count: 1 }]);
    expect(ran).toHaveLength(2);
  });

  it("pg skips guarded item when count is 0 and skips chained guards", async () => {
    const { db, ran } = fakeDb("PgDatabase", [{ count: 0 }]);
    expect(await atomic(db, () => [upd, guarded, guarded])).toEqual([{ count: 0 }, undefined, undefined]);
    expect(ran).toHaveLength(1);
  });

  it("mysql reads [{ affectedRows }]", async () => {
    const run = fakeDb("MySqlDatabase", [[{ affectedRows: 1 }], [{ affectedRows: 1 }]]);
    expect(await atomic(run.db, () => [upd, guarded])).toHaveLength(2);
    const skip = fakeDb("MySqlDatabase", [[{ affectedRows: 0 }]]);
    expect(await atomic(skip.db, () => [upd, guarded])).toEqual([[{ affectedRows: 0 }], undefined]);
  });

  it("unreadable driver result throws", async () => {
    const { db } = fakeDb("PgDatabase", [{ rowCount: 1 }]);
    await expect(atomic(db, () => [upd, guarded])).rejects.toThrow(/cannot read affected row count/);
  });

  it("readAffected rejects unreadable shapes", () => {
    expect(() => readAffected("mysql", undefined)).toThrow(/cannot read/);
    expect(() => readAffected("pg", {})).toThrow(/cannot read/);
    expect(readAffected("pg", { count: 2 })).toBe(2);
  });
});
