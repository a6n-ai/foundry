import type { SQL } from "drizzle-orm";
import type { AnyCol } from "./columns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BuiltCols = Record<string, any>;
export type SqlFn = (t: BuiltCols) => SQL;

export type Predicate = { kind: "notNull"; col: AnyCol } | { kind: "sql"; fn: SqlFn };

export interface IndexEntry {
  type: "index" | "unique";
  name: string;
  cols: AnyCol[];
  predicate?: Predicate;
}
export interface CheckEntry {
  type: "check";
  name: string;
  fn: SqlFn;
}
export type Extra = IndexEntry | CheckEntry;

class IndexBuilder {
  constructor(private type: "index" | "unique", private name: string) {}
  on(...cols: AnyCol[]) {
    return new IndexDef({ type: this.type, name: this.name, cols });
  }
}

export class IndexDef {
  constructor(readonly entry: IndexEntry) {}
  /** MySQL rejects any predicate other than whereNotNull. */
  where(fn: SqlFn) {
    return new IndexDef({ ...this.entry, predicate: { kind: "sql", fn } });
  }
  whereNotNull(col: AnyCol) {
    return new IndexDef({ ...this.entry, predicate: { kind: "notNull", col } });
  }
}

export const index = (name: string) => new IndexBuilder("index", name);
export const unique = (name: string) => new IndexBuilder("unique", name);
export const check = (name: string, fn: SqlFn): CheckEntry => ({ type: "check", name, fn });

export interface TableDef<N extends string = string, C extends Record<string, AnyCol> = Record<string, AnyCol>> {
  name: N;
  columns: C;
  extras: (IndexEntry | CheckEntry)[];
}

export function defineTable<const N extends string, C extends Record<string, AnyCol>>(
  name: N,
  columns: C,
  extras?: (cols: C) => (IndexDef | CheckEntry)[],
): TableDef<N, C> {
  for (const [key, col] of Object.entries(columns)) {
    col._table = name;
    col._key = key;
  }
  const entries = (extras?.(columns) ?? []).map((e) => (e instanceof IndexDef ? e.entry : e));
  for (const e of entries) {
    if (e.type === "check") continue;
    const cols = [...e.cols, ...(e.predicate?.kind === "notNull" ? [e.predicate.col] : [])];
    for (const col of e.cols) {
      if (col.spec.kind === "text") {
        throw new Error(`${name}.${e.name}: c.text column "${col.spec.name}" cannot be indexed (MySQL); use c.string`);
      }
    }
    for (const col of cols) {
      if (col._table !== name) throw new Error(`${name}.${e.name}: column "${col.spec.name}" is not in this table`);
    }
  }
  return { name, columns, extras: entries };
}
