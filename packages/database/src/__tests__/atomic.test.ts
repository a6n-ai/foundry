import { createClient } from "@libsql/client";
import { entityKind, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { drizzle as d1 } from "drizzle-orm/d1";
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

  it.each([
    ["PgDatabase", "insert into log select 1 on conflict do nothing"],
    ["PgDatabase", "insert into log select 1 returning id"],
    ["MySqlDatabase", "insert into log select 1 on duplicate key update id = id"],
    ["PgDatabase", "insert into log values (1)"],
  ])("%s rejects a guarded item that is not a plain INSERT … SELECT: %s", async (kind, text) => {
    const { db, ran } = fakeDb(kind, [{ count: 1 }, [{ affectedRows: 1 }]]);
    await expect(atomic(db, () => [upd, { query: sql.raw(text), onlyIfPreviousChanged: 1 }])).rejects.toThrow(
      /INSERT \.\.\. SELECT/,
    );
    expect(ran).toHaveLength(1);
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

describe("atomic (D1 path, fake binding)", () => {
  const fakeD1 = () => {
    const calls = { prepare: [] as string[], bind: [] as unknown[][], batch: [] as unknown[][] };
    const client = {
      prepare(text: string) {
        calls.prepare.push(text);
        const stmt = { text, params: [] as unknown[], bind: (...p: unknown[]) => (calls.bind.push(p), { ...stmt, params: p }) };
        return stmt;
      },
      batch: async (stmts: unknown[]) => (calls.batch.push(stmts), stmts.map(() => ({ success: true, meta: { changes: 1 } }))),
      exec: async () => { throw new Error("exec must not be called"); },
    };
    return { db: d1(client as never), calls };
  };

  it("sends one batch of prepared statements in order with bound params and a changes() guard", async () => {
    const { db: d, calls } = fakeD1();
    const res = await atomic(d, () => [
      sql`update t set v = ${9} where id = ${"a"}`,
      { query: sql`insert into log (id, ref) select ${"l1"}, id from t where id = ${"a"}`, onlyIfPreviousChanged: 1 },
      sql`insert into t (id, v) values (${"b"}, ${2})`,
    ]);
    expect(calls.batch).toHaveLength(1);
    expect(calls.batch[0]).toHaveLength(3);
    expect((calls.batch[0] as { text: string }[]).map((s) => s.text.split(" ")[0])).toEqual(["update", "insert", "insert"]);
    expect(calls.bind).toEqual([[9, "a"], ["l1", "a"], ["b", 2]]);
    expect(calls.prepare[1]).toContain("changes() = 1");
    expect(calls.prepare[0]).not.toContain("changes()");
    expect(res.map((r) => readAffected("sqlite", r))).toEqual([1, 1, 1]);
  });
});

describe("readAffected (sqlite)", () => {
  it("reads D1 meta.changes and libsql rowsAffected", () => {
    expect(readAffected("sqlite", { meta: { changes: 3 } })).toBe(3);
    expect(readAffected("sqlite", { rowsAffected: 2 })).toBe(2);
    expect(() => readAffected("sqlite", {})).toThrow(/cannot read/);
  });

  it("reads a real libsql write result", async () => {
    const [res] = await atomic(db, () => [sql`update t set v = 5 where id = 'a'`]);
    expect(readAffected("sqlite", res)).toBe(1);
  });
});
