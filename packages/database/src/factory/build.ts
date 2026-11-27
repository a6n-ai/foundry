import { sql } from "drizzle-orm";
import * as sl from "drizzle-orm/sqlite-core";
import * as pg from "drizzle-orm/pg-core";
import * as my from "drizzle-orm/mysql-core";
import type { SQLiteColumn, SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { MySqlColumn, MySqlTableWithColumns } from "drizzle-orm/mysql-core";
import type { Dialect } from "../types";
import type { AnyCol, Col, ColKind, ColSpec } from "./columns";
import type { Extra, IndexEntry, TableDef } from "./table";

type DataType<K extends ColKind> = K extends "int" | "time" | "timestamp" ? "number" : K extends "bool"
  ? "boolean"
  : K extends "json" ? "json" : "string";

type ColConfig<Tbl extends string, C extends AnyCol> = C extends Col<infer T, infer N, infer H, infer K>
  ? {
      name: string;
      tableName: Tbl;
      dataType: DataType<K>;
      columnType: string;
      data: T;
      driverParam: unknown;
      notNull: N;
      hasDefault: H;
      isPrimaryKey: boolean;
      isAutoincrement: false;
      hasRuntimeDefault: boolean;
      enumValues: undefined;
      baseColumn: never;
      identity: undefined;
      generated: undefined;
    }
  : never;

type Cols = Record<string, AnyCol>;

export type BuiltTable<D extends Dialect, N extends string, C extends Cols> = D extends "sqlite"
  ? SQLiteTableWithColumns<{ name: N; schema: undefined; dialect: "sqlite"; columns: { [K in keyof C]: SQLiteColumn<ColConfig<N, C[K]>> } }>
  : D extends "pg"
    ? PgTableWithColumns<{ name: N; schema: undefined; dialect: "pg"; columns: { [K in keyof C]: PgColumn<ColConfig<N, C[K]>> } }>
    : MySqlTableWithColumns<{ name: N; schema: undefined; dialect: "mysql"; columns: { [K in keyof C]: MySqlColumn<ColConfig<N, C[K]>> } }>;

export type BuiltTables<D extends Dialect, T extends Record<string, TableDef>> = {
  [K in keyof T]: T[K] extends TableDef<infer N, infer C> ? BuiltTable<D, N, C> : never;
};

const tsCol = pg.customType<{ data: Date; driverData: number }>({
  dataType: () => "bigint",
  toDriver: (v) => v.getTime(),
  fromDriver: (v) => new Date(Number(v)),
});
const tsColMy = my.customType<{ data: Date; driverData: number }>({
  dataType: () => "bigint",
  toDriver: (v) => v.getTime(),
  fromDriver: (v) => new Date(Number(v)),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function rawColumn(d: Dialect, s: ColSpec): any {
  const n = s.name;
  switch (d) {
    case "sqlite":
      switch (s.kind) {
        case "int": case "time": return sl.integer(n);
        case "bool": return sl.integer(n, { mode: "boolean" });
        case "timestamp": return sl.integer(n, { mode: "timestamp_ms" });
        case "json": return sl.text(n, { mode: "json" });
        default: return sl.text(n);
      }
    case "pg":
      switch (s.kind) {
        case "string": return pg.varchar(n, { length: s.length });
        case "int": return pg.integer(n);
        case "bool": return pg.boolean(n);
        case "time": return pg.bigint(n, { mode: "number" });
        case "timestamp": return tsCol(n);
        case "json": return pg.jsonb(n);
        default: return pg.text(n);
      }
    case "mysql":
      switch (s.kind) {
        case "id": case "ref": return my.varchar(n, { length: 32 });
        case "string": return my.varchar(n, { length: s.length });
        case "text": return my.text(n);
        case "int": return my.int(n);
        case "bool": return my.boolean(n);
        case "time": return my.bigint(n, { mode: "number" });
        case "timestamp": return tsColMy(n);
        case "json": return my.json(n);
      }
  }
}

function buildColumn(d: Dialect, s: ColSpec, lookup: (c: AnyCol) => any): any {
  let b = rawColumn(d, s);
  if (s.primaryKey) b = b.primaryKey();
  if (s.notNull) b = b.notNull();
  if (s.default !== undefined) b = b.default(s.default);
  if (s.defaultFn) b = b.$defaultFn(s.defaultFn);
  if (s.onUpdateFn) b = b.$onUpdateFn(s.onUpdateFn);
  if (s.references) {
    const r = s.references;
    b = b.references(() => lookup(r.target()), r.onDelete ? { onDelete: r.onDelete } : undefined);
  }
  return b;
}

/**
 * drizzle-kit only discovers top-level exported tables, so a schema module must destructure:
 * `export const { users, inquiries } = buildTables(defs, "sqlite")`, never `export const tables = buildTables(...)`.
 */
export function buildTables<D extends Dialect, T extends Record<string, TableDef>>(
  defs: T,
  dialect: D,
): BuiltTables<D, T> {
  const built: Record<string, any> = {};
  const lookup = (col: AnyCol) => {
    const t = built[col._table!];
    if (!t) throw new Error(`reference to column "${col.spec.name}" of a table not passed to buildTables`);
    return t[col._key!];
  };
  const kit = { sqlite: { table: sl.sqliteTable, idx: sl.index, uidx: sl.uniqueIndex, check: sl.check },
    pg: { table: pg.pgTable, idx: pg.index, uidx: pg.uniqueIndex, check: pg.check },
    mysql: { table: my.mysqlTable, idx: my.index, uidx: my.uniqueIndex, check: my.check } }[dialect] as any;

  const buildExtra = (t: any, tableName: string, e: Extra) => {
    if (e.type === "check") return kit.check(e.name, e.fn(t));
    const cols = e.cols.map((col) => t[col._key!]);
    let b = (e.type === "unique" ? kit.uidx : kit.idx)(e.name).on(...cols);
    const p = (e as IndexEntry).predicate;
    if (p) {
      if (dialect === "mysql") {
        if (p.kind !== "notNull") {
          throw new Error(`${tableName}.${e.name}: MySQL supports only an IS NOT NULL partial index`);
        }
      } else {
        b = b.where(p.kind === "notNull" ? sql`${t[p.col._key!]} is not null` : p.fn(t));
      }
    }
    return b;
  };

  if (dialect === "mysql") {
    for (const def of Object.values(defs)) {
      for (const e of def.extras) {
        if (e.type !== "check" && e.predicate && e.predicate.kind !== "notNull") {
          throw new Error(`${def.name}.${e.name}: MySQL supports only an IS NOT NULL partial index`);
        }
      }
    }
  }

  const names = new Set<string>();
  for (const def of Object.values(defs)) {
    if (names.has(def.name)) throw new Error(`buildTables: duplicate table name "${def.name}"`);
    names.add(def.name);
  }
  for (const def of Object.values(defs)) {
    const cols = Object.fromEntries(
      Object.entries(def.columns).map(([k, col]) => [k, buildColumn(dialect, col.spec, lookup)]),
    );
    built[def.name] = kit.table(def.name, cols, def.extras.length
      ? (t: any) => def.extras.map((e) => buildExtra(t, def.name, e))
      : undefined);
  }
  return Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, built[d.name]])) as any;
}
