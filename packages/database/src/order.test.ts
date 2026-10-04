import { bigint, pgTable, text } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pageOrder } from "./order";

const t = pgTable("t", { id: bigint("id", { mode: "bigint" }).primaryKey(), name: text("name") });
const render = (parts: ReturnType<typeof pageOrder>) => new PgDialect().sqlToQuery(sql.join(parts, sql`, `)).sql;

describe("pageOrder", () => {
  it("appends the tiebreak in the same direction", () => {
    expect(render(pageOrder("desc", t.name, t.id))).toBe('"t"."name" desc, "t"."id" desc');
    expect(render(pageOrder("asc", sql`count(*)`, t.id))).toBe('count(*) asc, "t"."id" asc');
  });
});
