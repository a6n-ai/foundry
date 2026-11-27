# @foundry/database

Database-agnostic table definitions, repositories and services for SQLite (D1 and libsql), Postgres and MySQL.

## One database per app

Each app uses exactly one database. The app installs only the driver peer for that database. Migrations run only against that database, because `drizzle-kit` reads the app's own `db/schema.ts`, which holds tables of one dialect.

## Driver entries

Import the root for the dialect-neutral API. Import a driver from its subpath:

| Entry | Dialect | Peer to install |
| --- | --- | --- |
| `@foundry/database/d1` | SQLite (Cloudflare D1) | `drizzle-orm` |
| `@foundry/database/libsql` | SQLite (libsql) | `@libsql/client` |
| `@foundry/database/postgres` | Postgres | `postgres` |
| `@foundry/database/mysql` | MySQL | `mysql2` |
| `@foundry/database/factory` | Table factory (`c`, `defineTable`, `buildTables`) | `drizzle-orm` |

The root never imports a driver at runtime, and imports no dialect core except one exception: `baseColumns`/`updatableColumns` (`src/columns.ts`) load `drizzle-orm/pg-core` until A-step 2 moves them to `@foundry/database/pg`. Drivers are only loaded through their subpath. The factory is also on its own subpath because it loads the dialect cores.

## Defining tables

Describe each table once with the neutral descriptors (`c.id`, `c.ref`, `c.string`, `c.text`, `c.int`, `c.bool`, `c.time`, `c.timestamp`, `c.json`). Import them from `@foundry/database/factory`. The app then calls `buildTables(tables, "sqlite" | "pg" | "mysql")` once, in its schema module, and destructures the result into top-level exports (`export const { users } = buildTables(...)`) so drizzle-kit finds each table. Queries never branch on the dialect.

The descriptors map to each dialect as follows:

| Descriptor | SQLite / D1 | Postgres | MySQL | JS type |
| --- | --- | --- | --- | --- |
| `c.id(prefix)` | `text` PK | `text` PK | `varchar(32)` PK | `string` (`inq_Ab3…`) |
| `c.ref(name)` | `text` | `text` | `varchar(32)` | `string` |
| `c.string(name, len=255)` | `text` | `varchar(len)` | `varchar(len)` | `string` |
| `c.text(name)` | `text` | `text` | `text` (never indexed) | `string` |
| `c.int(name)` | `integer` | `integer` | `int` | `number` |
| `c.bool(name)` | `integer` (boolean mode) | `boolean` | `boolean` | `boolean` |
| `c.time(name)` | `integer` | `bigint` (number mode) | `bigint` (number mode) | `number` (epoch ms) |
| `c.timestamp(name)` | `integer` (`timestamp_ms` mode) | `bigint` via `customType` | `bigint` via `customType` | `Date` (stored as epoch ms) |
| `c.json(name)` | `text` (json mode) | `jsonb` | `json` | typed via `.$type<T>()` |

## Portability rules

- **Ids are text, generated in JS.** An id is a 3-letter prefix, `_`, then 12 characters. Do not use `bigint` ids in factory tables: D1 returns integers as JS numbers, which lose precision above 2^53.
- **Use `c.time` for epoch-ms numbers and `c.timestamp` for `Date`.** Both store epoch ms, but they read back as different JS types.
- **No `TEXT` indexes on MySQL.** Use `c.string` for anything indexed.
- **No enums, arrays or `numeric` columns.** Store the value in a `c.string` or `c.int` column instead.
- **Partial indexes on MySQL must use `IS NOT NULL`.** Any other partial index throws when the table is built.

## Atomic writes

`atomic(db, (q) => [...])` runs a list of statements that commit together or not at all.

- A unit cannot read a row it wrote earlier in the same unit (no read-after-write).
- A guarded item runs only when the previous item changed exactly one row. A guarded item must be a plain `INSERT ... SELECT`, placed directly after an `INSERT`, `UPDATE` or `DELETE`. It may not use `ON CONFLICT` or `RETURNING`.
- D1 allows at most 100 bound parameters per statement. Keep units small, or split them.
- Each result is the raw driver result, in item order, so its shape depends on the driver: pg (postgres-js) a row array with `.count`; mysql (mysql2) `[ResultSetHeader, fields]`; D1 `{ results, success, meta: { changes } }`; libsql `{ rows, rowsAffected }`. A skipped guarded item is a 0-row result on sqlite and `undefined` on pg/mysql. Use `readAffected(dialect, result)` for a portable affected-row count.

## `like` case folding

`like` filters do not fold case the same way on every dialect:

- Postgres uses `ilike`, so ASCII and Unicode letters fold.
- SQLite `LIKE` folds ASCII letters only.
- MySQL follows the column collation. The portable suite (`src/__tests__/portable-repository.test.ts`) runs in foundry CI (`.github/workflows/ci.yml`) against `mysql:8.4`, whose default collation is `utf8mb4_0900_ai_ci`, where `like` is case-insensitive.

Do not rely on non-ASCII case folding in app code.

## Deprecated root exports

`baseColumns`, `updatableColumns`, `postgresOptions` and the `Database` type are deprecated. They still work for existing Postgres code. They move to `@foundry/database/pg` in A-step 2 and are removed on the first foundry commit on or after Part B go-live + 14 days.
