import { type SQL, type SQLWrapper, StringChunk, sql } from "drizzle-orm";
import { dialectOf } from "./dialect";
import type { AnyDatabase, Dialect } from "./types";

/**
 * Flat `sql` templates only. A guarded item must directly follow an INSERT/UPDATE/DELETE and be a plain
 * INSERT ... SELECT (no ON CONFLICT/RETURNING) on every dialect. A skipped guarded item yields a 0-row
 * result on sqlite and `undefined` on pg/mysql.
 */
export type BatchItem = SQLWrapper | { query: SQLWrapper; onlyIfPreviousChanged: 1 };

const isGuarded = (i: BatchItem): i is { query: SQLWrapper; onlyIfPreviousChanged: 1 } =>
  "onlyIfPreviousChanged" in i;

const isThenable = (x: unknown): x is PromiseLike<unknown> =>
  typeof (x as { then?: unknown }).then === "function";

// Wraps the trailing SELECT of an unguarded INSERT ... SELECT so it yields no rows
// unless the previous statement in the batch changed exactly one row.
function guardedShape(query: SQLWrapper): { chunks: unknown[]; at: number; head: string } {
  const chunks = [...query.getSQL().queryChunks];
  const at = chunks.findIndex((c) => c instanceof StringChunk && /\bselect\b/i.test(c.value.join("")));
  const head = at < 0 ? undefined : (chunks[at] as StringChunk).value.join("");
  if (head === undefined || !/^\s*insert\b/i.test(chunks[0] instanceof StringChunk ? chunks[0].value.join("") : "")) {
    throw new Error("onlyIfPreviousChanged requires an INSERT ... SELECT query");
  }
  const text = chunks.map((c) => (c instanceof StringChunk ? c.value.join("") : "")).join(" ");
  if (/\b(on\s+conflict|on\s+duplicate\s+key|returning)\b/i.test(text)) {
    throw new Error("guarded items must be a plain INSERT ... SELECT without ON CONFLICT/RETURNING");
  }
  return { chunks, at, head };
}

function guardSqlite(query: SQLWrapper): SQL {
  const { chunks, at, head } = guardedShape(query);
  const cut = head.search(/\bselect\b/i);
  return sql.join(
    [
      ...(chunks.slice(0, at) as SQL[]),
      sql.raw(`${head.slice(0, cut)}SELECT * FROM (${head.slice(cut)}`),
      ...(chunks.slice(at + 1) as SQL[]),
      sql.raw(") WHERE changes() = 1"),
    ],
    sql.raw(""),
  );
}

/**
 * Affected-row count of one write, per driver result shape:
 * - pg (postgres-js): `{ count }`
 * - mysql (mysql2): `[{ affectedRows }, fields]`
 * - sqlite D1: `{ meta: { changes } }`; sqlite libsql: `{ rowsAffected }`
 */
export function readAffected(dialect: Dialect, res: unknown): number {
  type R = { count?: unknown; rowsAffected?: unknown; meta?: { changes?: unknown } } | null | undefined;
  const r = res as R;
  const n =
    dialect === "pg"
      ? r?.count
      : dialect === "sqlite"
        ? (r?.meta?.changes ?? r?.rowsAffected)
        : (res as [{ affectedRows?: unknown }] | null | undefined)?.[0]?.affectedRows;
  if (typeof n !== "number") throw new Error("atomic: cannot read affected row count from driver result");
  return n;
}

/**
 * All items commit together or none do. D1 has no interactive transactions, so sqlite uses one batch
 * (D1: `$client.batch` of prepared statements; libsql: `db.batch`).
 *
 * Results are the raw driver results, in item order, so their shape depends on the driver:
 * - pg (postgres-js): a row array with `.count`
 * - mysql (mysql2): `[ResultSetHeader, fields]`; skipped guarded items are `undefined`
 * - sqlite D1: `{ results, success, meta: { changes, ... } }`
 * - sqlite libsql: `{ rows, rowsAffected, ... }`
 * Use `readAffected(dialect, result)` for a portable affected-row count.
 */
export async function atomic<TDb extends AnyDatabase>(
  db: TDb,
  build: (q: TDb) => BatchItem[],
): Promise<unknown[]> {
  const dialect = dialectOf(db);
  const any = db as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (dialect === "sqlite") {
    const stmts = build(db).map((item) => {
      const q = isGuarded(item) ? guardSqlite(item.query) : item;
      return isThenable(q) ? q : any.run(q.getSQL());
    });
    // Drizzle's D1 batch needs prepared statements, which a raw `db.run(sql)` does not carry.
    const client = any.$client;
    if (typeof client?.prepare === "function" && typeof client?.batch === "function") {
      return client.batch(
        stmts.map((s: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const { sql: text, params } = typeof s.toSQL === "function" ? s.toSQL() : s.getQuery();
          return client.prepare(text).bind(...params);
        }),
      );
    }
    return any.batch(stmts);
  }
  return any.transaction(async (tx: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const results: unknown[] = [];
    let prev: unknown;
    let skipped = false;
    for (const item of build(tx)) {
      const guarded = isGuarded(item);
      if (guarded) guardedShape(item.query);
      if (guarded && (skipped || readAffected(dialect, prev) !== 1)) {
        results.push(undefined);
        prev = undefined;
        skipped = true;
        continue;
      }
      skipped = false;
      const q = guarded ? item.query : item;
      prev = await (isThenable(q) ? q : tx.execute(q.getSQL()));
      results.push(prev);
    }
    return results;
  });
}

export function sqlNewId(prefix: string, dialect: Dialect): SQL {
  if (!/^[a-z]{3}$/.test(prefix)) {
    throw new Error(`id prefix must be exactly 3 lowercase letters, got "${prefix}"`);
  }
  const p = `${prefix}_`;
  if (dialect === "sqlite") return sql`${p} || lower(hex(randomblob(6)))`;
  if (dialect === "pg") return sql`${p} || substr(md5(random()::text || clock_timestamp()::text), 1, 12)`;
  return sql`CONCAT(${p}, LOWER(HEX(RANDOM_BYTES(6))))`;
}
