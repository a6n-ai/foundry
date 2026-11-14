// The in-memory half of Condition: filter, sort and page plain rows with the same rules `conditionToSql`
// (@foundry/database) gives the database, so a list can load flat rows once and work them in JS instead of
// building one large SQL expression per filter.
import { ValidationError } from "../errors";
import type { Condition, FilterCondition } from "./condition";
import type { Page, PageRequest } from "../util/pagination";

/** Filter names that are not plain row keys, mapped to how to read them from a row. */
export type QueryFields<T> = Record<string, (row: T) => unknown>;
export type RowSort = { field: string; dir: "asc" | "desc" };

function read<T>(row: T, field: string, fields: QueryFields<T>): unknown {
  const get = fields[field];
  if (get) return get(row);
  if (row != null && typeof row === "object" && field in row) return (row as Record<string, unknown>)[field];
  throw new ValidationError(`Unknown field: ${field}`);
}

// Strings compare as strings, everything else (numbers, bigint, ISO dates as strings) by <, >.
const cmp = (a: unknown, b: unknown): number => {
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  const x = a as number, y = b as number;
  return x < y ? -1 : x > y ? 1 : 0;
};

// ilike: % is any run, _ any one character, case-insensitive; everything else is literal.
const likeCache = new Map<string, RegExp>();
function likeRegex(pattern: string): RegExp {
  let re = likeCache.get(pattern);
  if (!re) {
    const body = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
    re = new RegExp(`^${body}$`, "is");
    likeCache.set(pattern, re);
  }
  return re;
}

const same = (a: unknown, b: unknown) => (typeof a === "bigint" || typeof b === "bigint" ? String(a) === String(b) : a === b);

function matchFilter<T>(row: T, f: FilterCondition, fields: QueryFields<T>): boolean {
  if (f.operator === "in" && (f.value as unknown[]).length === 0) return true; // conditionToSql drops an empty in-list
  const v = read(row, f.field, fields);
  // SQL three-valued logic: a null operand never satisfies a comparison.
  if (v == null) return false;
  switch (f.operator) {
    case "eq": return f.value != null && same(v, f.value);
    case "in": return (f.value as unknown[]).some((x) => x != null && same(v, x));
    case "like": return typeof f.value === "string" && likeRegex(f.value).test(String(v));
    case "gt": return f.value != null && cmp(v, f.value) > 0;
    case "gte": return f.value != null && cmp(v, f.value) >= 0;
    case "lt": return f.value != null && cmp(v, f.value) < 0;
    case "lte": return f.value != null && cmp(v, f.value) <= 0;
    case "between": {
      const [a, b] = f.value as [unknown, unknown];
      return a != null && b != null && cmp(v, a) >= 0 && cmp(v, b) <= 0;
    }
  }
}

/** Whether `row` satisfies `condition` (no condition: every row). */
export function matches<T>(row: T, condition: Condition | undefined, fields: QueryFields<T> = {}): boolean {
  if (!condition) return true;
  if (condition.type === "complex") {
    // conditionToSql drops empty groups, so an empty and/or keeps every row.
    if (condition.conditions.length === 0) return true;
    return condition.operator === "and"
      ? condition.conditions.every((c) => matches(row, c, fields))
      : condition.conditions.some((c) => matches(row, c, fields));
  }
  return matchFilter(row, condition, fields);
}

/**
 * A sorted copy. Nulls sort last ascending and first descending (the Postgres default); equal values keep
 * their order, then `tieBreak` (usually the id) settles them so pages are stable.
 */
export function sortRows<T>(rows: readonly T[], sort: RowSort, fields: QueryFields<T> = {}, tieBreak?: string): T[] {
  const dir = sort.dir === "desc" ? -1 : 1;
  const keyed = rows.map((row, i) => ({ row, i, v: read(row, sort.field, fields), t: tieBreak ? read(row, tieBreak, fields) : i }));
  keyed.sort((a, b) => {
    if (a.v == null || b.v == null) {
      if (a.v == null && b.v != null) return dir;
      if (b.v == null && a.v != null) return -dir;
    } else {
      const c = cmp(a.v, b.v);
      if (c !== 0) return c * dir;
    }
    return cmp(a.t, b.t) * dir || a.i - b.i;
  });
  return keyed.map((k) => k.row);
}

/** One 0-based page of `rows`, with the full count as `total`. */
export function pageRows<T>(rows: readonly T[], page: Pick<PageRequest, "page" | "size">): Page<T> {
  const start = page.page * page.size;
  return { items: rows.slice(start, start + page.size), page: page.page, size: page.size, total: rows.length };
}

/** Filter, then sort, then page: the in-memory equivalent of a list query. */
export function queryRows<T>(
  rows: readonly T[],
  q: { condition?: Condition; sort?: RowSort; page: Pick<PageRequest, "page" | "size">; fields?: QueryFields<T>; tieBreak?: string },
): Page<T> {
  const fields = q.fields ?? {};
  const kept = rows.filter((r) => matches(r, q.condition, fields));
  return pageRows(q.sort ? sortRows(kept, q.sort, fields, q.tieBreak) : kept, q.page);
}
