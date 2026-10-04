import { asc, desc, type AnyColumn, type SQL, type SQLWrapper } from "drizzle-orm";

// Offset paging needs a total order: rows that tie on the sort value come back in
// arbitrary order per query, so they repeat or vanish across page boundaries.
// The unique tiebreak (usually the internal id) pins each row to one page.
export function pageOrder(dir: "asc" | "desc", by: AnyColumn | SQLWrapper, tiebreak: AnyColumn): SQL[] {
  const order = dir === "desc" ? desc : asc;
  return [order(by), order(tiebreak)];
}
