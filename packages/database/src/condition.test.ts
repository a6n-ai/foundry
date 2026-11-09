import { and, between, eq, inList, ValidationError } from "@foundry/commons";
import { bigint, integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { resolveColumn, toDrizzleWhere } from "./condition";

const dialect = new PgDialect();
const render = (where: ReturnType<typeof toDrizzleWhere>) => dialect.sqlToQuery(where!);

const demo = pgTable("demo", {
  id: bigint("id", { mode: "bigint" }).primaryKey(),
  status: text("status"),
  kcal: integer("kcal"),
});

describe("toDrizzleWhere", () => {
  it("returns undefined for no condition", () => {
    expect(toDrizzleWhere(demo, undefined)).toBeUndefined();
  });
  it("translates an eq filter to SQL", () => {
    const where = toDrizzleWhere(demo, eq("status", "active"));
    expect(render(where)).toMatchObject({ sql: '"demo"."status" = $1', params: ["active"] });
  });
  it("translates in/between/complex", () => {
    const where = toDrizzleWhere(demo, and(inList("status", ["a", "b"]), between("kcal", 500, 900)));
    expect(render(where)).toMatchObject({
      sql: '("demo"."status" in ($1, $2) and ("demo"."kcal" >= $3 and "demo"."kcal" <= $4))',
      params: ["a", "b", 500, 900],
    });
  });
  it("throws ValidationError on an unknown field", () => {
    expect(() => toDrizzleWhere(demo, eq("nope", 1))).toThrow(ValidationError);
  });
});

describe("resolveColumn", () => {
  it("returns the column for a known field", () => {
    expect(resolveColumn(demo, "status")).toBe(demo.status);
  });
  it("throws ValidationError (400) for an unknown field", () => {
    try {
      resolveColumn(demo, "nope");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(400);
    }
  });
});
