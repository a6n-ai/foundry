import { describe, expect, it } from "vitest";
import { and, between, eq, gt, gte, inList, like, lt, lte, or } from "./condition";
import { matches, pageRows, queryRows, sortRows, type QueryFields } from "./query";

type Row = { id: number; name: string | null; status: string; total: number | null; owner: { id: string } | null };
const rows: Row[] = [
  { id: 1, name: "Asha Rao", status: "active", total: 120, owner: { id: "u1" } },
  { id: 2, name: "ben lee", status: "paused", total: null, owner: null },
  { id: 3, name: null, status: "active", total: 80, owner: { id: "u2" } },
  { id: 4, name: "Chandra", status: "completed", total: 200, owner: { id: "u1" } },
];
const fields: QueryFields<Row> = { owner: (r) => r.owner?.id ?? null };

describe("matches: the same rules conditionToSql gives the database", () => {
  it("eq, in, and the comparisons", () => {
    expect(rows.filter((r) => matches(r, eq("status", "active"))).map((r) => r.id)).toEqual([1, 3]);
    expect(rows.filter((r) => matches(r, inList("status", ["paused", "completed"]))).map((r) => r.id)).toEqual([2, 4]);
    expect(rows.filter((r) => matches(r, gt("total", 100))).map((r) => r.id)).toEqual([1, 4]);
    expect(rows.filter((r) => matches(r, gte("total", 120))).map((r) => r.id)).toEqual([1, 4]);
    expect(rows.filter((r) => matches(r, lt("total", 100))).map((r) => r.id)).toEqual([3]);
    expect(rows.filter((r) => matches(r, lte("total", 80))).map((r) => r.id)).toEqual([3]);
  });

  it("between includes both ends", () => {
    expect(rows.filter((r) => matches(r, between("total", 80, 120))).map((r) => r.id)).toEqual([1, 3]);
  });

  it("like is case-insensitive with % and _ wildcards (ilike)", () => {
    expect(rows.filter((r) => matches(r, like("name", "%LEE%"))).map((r) => r.id)).toEqual([2]);
    expect(rows.filter((r) => matches(r, like("name", "chandr_"))).map((r) => r.id)).toEqual([4]);
    expect(rows.filter((r) => matches(r, like("name", "a.ha%"))).map((r) => r.id)).toEqual([]);
  });

  it("null never matches a comparison, like SQL", () => {
    expect(matches(rows[1], lt("total", 1000))).toBe(false);
    expect(matches(rows[2], like("name", "%"))).toBe(false);
    expect(matches(rows[1], eq("owner", null), fields)).toBe(false);
  });

  it("an empty in-list filters nothing out, as conditionToSql drops it", () => {
    expect(rows.filter((r) => matches(r, inList("status", []))).length).toBe(4);
  });

  it("and/or nest, and fields map a filter name to a derived value", () => {
    const c = and(eq("owner", "u1"), or(eq("status", "active"), gt("total", 150)));
    expect(rows.filter((r) => matches(r, c, fields)).map((r) => r.id)).toEqual([1, 4]);
    expect(rows.filter((r) => matches(r, undefined)).length).toBe(4);
  });

  it("rejects a field the row does not have, like resolveColumn", () => {
    expect(() => matches(rows[0], eq("nope", 1))).toThrow(/Unknown field: nope/);
  });
});

describe("sortRows / pageRows / queryRows", () => {
  it("sorts nulls last ascending and first descending, as Postgres does, then by the tie-breaker", () => {
    expect(sortRows(rows, { field: "total", dir: "asc" }).map((r) => r.id)).toEqual([3, 1, 4, 2]);
    expect(sortRows(rows, { field: "total", dir: "desc" }).map((r) => r.id)).toEqual([2, 4, 1, 3]);
    expect(sortRows(rows, { field: "status", dir: "asc" }, {}, "id").map((r) => r.id)).toEqual([1, 3, 4, 2]);
  });

  it("does not reorder the input", () => {
    const copy = [...rows];
    sortRows(rows, { field: "total", dir: "asc" });
    expect(rows).toEqual(copy);
  });

  it("pages are 0-based and report the full total", () => {
    expect(pageRows(rows, { page: 1, size: 3 })).toEqual({ items: [rows[3]], page: 1, size: 3, total: 4 });
  });

  it("filters, sorts and pages in one call", () => {
    const p = queryRows(rows, { condition: eq("owner", "u1"), sort: { field: "total", dir: "desc" }, page: { page: 0, size: 1 }, fields });
    expect(p).toEqual({ items: [rows[3]], page: 0, size: 1, total: 2 });
  });
});
