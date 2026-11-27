import type { BaseSQLiteDatabase, SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { PgColumn, PgDatabase, PgTable } from "drizzle-orm/pg-core";
import type { MySqlColumn, MySqlDatabase, MySqlTable } from "drizzle-orm/mysql-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Schema generic is intentionally loose: repositories use Drizzle's core query
 * builder (select/insert/update/delete), never the relational query API, so the
 * concrete schema shape is irrelevant — and pinning it would reject every app
 * `db` typed with its own schema.
 *
 * @deprecated moves to `@foundry/database/pg` in A-step 2; removal on the first foundry commit on or after Part B go-live + 14 days.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = PostgresJsDatabase<any>;

export type Dialect = "sqlite" | "pg" | "mysql";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyDatabase =
  | BaseSQLiteDatabase<any, any, any>
  | PgDatabase<any, any, any>
  | MySqlDatabase<any, any, any, any>;
export type AnyTable = SQLiteTable | PgTable | MySqlTable;
export type AnyColumn = SQLiteColumn | PgColumn | MySqlColumn;
