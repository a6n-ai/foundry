import { entityKind } from "drizzle-orm";
import type { Dialect } from "./types";

const FAMILIES: Record<string, Dialect> = {
  BaseSQLiteDatabase: "sqlite",
  PgDatabase: "pg",
  MySqlDatabase: "mysql",
  SQLiteDialect: "sqlite",
  PgDialect: "pg",
  MySqlDialect: "mysql",
};

function familyOf(value: unknown): Dialect | undefined {
  // The concrete class (D1Database, SQLiteAsyncDialect, ...) is not the family; walk up to the base class.
  let proto: object | null = typeof value === "object" && value !== null ? Object.getPrototypeOf(value) : null;
  while (proto) {
    const kind = (proto.constructor as { [entityKind]?: string } | undefined)?.[entityKind];
    if (kind && kind in FAMILIES) return FAMILIES[kind]!;
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

export function dialectOf(db: unknown): Dialect {
  const direct = familyOf(db);
  if (direct) return direct;
  // Workers apps export `new Proxy({}, { get })` over a per-request db; the prototype is Object, but `dialect` is forwarded.
  const viaDialect = typeof db === "object" && db !== null ? familyOf((db as { dialect?: unknown }).dialect) : undefined;
  if (viaDialect) return viaDialect;
  throw new Error("unknown drizzle database");
}

export function supportsReturning(d: Dialect): boolean {
  return d !== "mysql";
}
