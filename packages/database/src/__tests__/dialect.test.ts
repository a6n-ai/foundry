import { createClient } from "@libsql/client";
import { drizzle as libsql } from "drizzle-orm/libsql";
import { drizzle as pg } from "drizzle-orm/postgres-js";
import { drizzle as mysql } from "drizzle-orm/mysql2";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { dialectOf, supportsReturning } from "../dialect";
import { UpdatableRepository } from "../repository";
import { buildTables, c, defineTable } from "../factory";

// Same shape as the Workers apps' db/client.ts: a Proxy over an empty object forwarding every get.
const workersProxy = <T extends object>(real: T): T =>
  new Proxy({} as T, {
    get(_t, prop) {
      const v = Reflect.get(real, prop, real);
      return typeof v === "function" ? v.bind(real) : v;
    },
  });

describe("dialectOf", () => {
  it("detects sqlite and its transaction", async () => {
    const db = libsql(createClient({ url: ":memory:" }));
    expect(dialectOf(db)).toBe("sqlite");
    await db.transaction(async (tx) => {
      expect(dialectOf(tx)).toBe("sqlite");
    });
  });
  it("detects pg", () => {
    expect(dialectOf(pg.mock())).toBe("pg");
  });
  it("detects mysql", () => {
    expect(dialectOf(mysql.mock())).toBe("mysql");
  });
  it("detects the dialect through a Workers-style Proxy", () => {
    expect(dialectOf(workersProxy(libsql(createClient({ url: ":memory:" }))))).toBe("sqlite");
    expect(dialectOf(workersProxy(pg.mock()))).toBe("pg");
    expect(dialectOf(workersProxy(mysql.mock()))).toBe("mysql");
  });
  it("repository create and findMany work through a Proxy-wrapped libsql db", async () => {
    const tables = buildTables({ notes: defineTable("notes", { ...c.updatable("not"), body: c.string("body") }) }, "sqlite");
    const real = libsql(createClient({ url: ":memory:" }), { schema: tables });
    await real.run(
      sql.raw("CREATE TABLE notes (id text PRIMARY KEY, created_at integer NOT NULL, created_by text, updated_at integer NOT NULL, updated_by text, body text)"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new UpdatableRepository<any, any, string>(workersProxy(real), tables.notes, tables.notes.id, tables.notes.id);
    const row = await repo.create({ body: "hi" });
    expect(row.id).toMatch(/^not_/);
    expect((await repo.findMany(undefined)).items.map((i: { id: string }) => i.id)).toEqual([row.id]);
  });
  it("throws on unknown", () => {
    expect(() => dialectOf({})).toThrow("unknown drizzle database");
  });
  it("supportsReturning", () => {
    expect(supportsReturning("mysql")).toBe(false);
    expect(supportsReturning("pg")).toBe(true);
    expect(supportsReturning("sqlite")).toBe(true);
  });
});
