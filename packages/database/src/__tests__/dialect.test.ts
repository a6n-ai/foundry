import { createClient } from "@libsql/client";
import { drizzle as libsql } from "drizzle-orm/libsql";
import { drizzle as pg } from "drizzle-orm/postgres-js";
import { drizzle as mysql } from "drizzle-orm/mysql2";
import { describe, expect, it } from "vitest";
import { dialectOf, supportsReturning } from "../dialect";

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
  it("throws on unknown", () => {
    expect(() => dialectOf({})).toThrow("unknown drizzle database");
  });
  it("supportsReturning", () => {
    expect(supportsReturning("mysql")).toBe(false);
    expect(supportsReturning("pg")).toBe(true);
    expect(supportsReturning("sqlite")).toBe(true);
  });
});
