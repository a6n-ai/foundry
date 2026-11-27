import { entityKind } from "drizzle-orm";
import type { Dialect } from "./types";

const FAMILIES: Record<string, Dialect> = {
  BaseSQLiteDatabase: "sqlite",
  PgDatabase: "pg",
  MySqlDatabase: "mysql",
};

export function dialectOf(db: unknown): Dialect {
  // The concrete driver class (D1Database, ...) is not the family; walk up to the base class.
  let proto: object | null = typeof db === "object" && db !== null ? Object.getPrototypeOf(db) : null;
  while (proto) {
    const kind = (proto.constructor as { [entityKind]?: string } | undefined)?.[entityKind];
    if (kind && kind in FAMILIES) return FAMILIES[kind]!;
    proto = Object.getPrototypeOf(proto);
  }
  throw new Error("unknown drizzle database");
}

export function supportsReturning(d: Dialect): boolean {
  return d !== "mysql";
}
