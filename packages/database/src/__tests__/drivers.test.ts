import { describe, expect, it } from "vitest";
import { dialectOf } from "../dialect";
import { connectD1 } from "../drivers/d1";
import { connectLibsql } from "../drivers/libsql";
import { connectMysql } from "../drivers/mysql";
import { connectPostgres } from "../drivers/postgres";

describe("driver entries", () => {
  it("connectLibsql returns a sqlite db", () => {
    expect(dialectOf(connectLibsql(":memory:", {}))).toBe("sqlite");
  });
  it("connectPostgres accepts a url and a hyperdrive binding", () => {
    expect(dialectOf(connectPostgres("postgres://u:p@127.0.0.1:1/db", {}))).toBe("pg");
    expect(dialectOf(connectPostgres({ connectionString: "postgres://u:p@127.0.0.1:1/db" }, {}))).toBe("pg");
  });
  it("connectMysql accepts a url and a hyperdrive binding", () => {
    expect(dialectOf(connectMysql("mysql://u:p@127.0.0.1:1/db", {}))).toBe("mysql");
    expect(dialectOf(connectMysql({ connectionString: "mysql://u:p@127.0.0.1:1/db" }, {}))).toBe("mysql");
  });
  it("connectD1 wraps a binding as sqlite", () => {
    const binding = { prepare: () => ({}), batch: async () => [] };
    expect(dialectOf(connectD1(binding, {}))).toBe("sqlite");
  });
});
