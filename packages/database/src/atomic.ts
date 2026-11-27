import { type SQL, type SQLWrapper, StringChunk, sql } from "drizzle-orm";
import { dialectOf } from "./dialect";
import type { AnyDatabase, Dialect } from "./types";

/**
 * Flat `sql` templates only. A guarded item must directly follow an INSERT/UPDATE/DELETE and be a plain
 * INSERT ... SELECT (no ON CONFLICT/RETURNING). A skipped guarded item yields a 0-row result on sqlite
 * and `undefined` on pg/mysql.
 */
export type BatchItem = SQLWrapper | { query: SQLWrapper; onlyIfPreviousChanged: 1 };

const isGuarded = (i: BatchItem): i is { query: SQLWrapper; onlyIfPreviousChanged: 1 } =>
  "onlyIfPreviousChanged" in i;

const isThenable = (x: unknown): x is PromiseLike<unknown> =>
  typeof (x as { then?: unknown }).then === "function";

// Wraps the trailing SELECT of an unguarded INSERT ... SELECT so it yields no rows
// unless the previous statement in the batch changed exactly one row.
function guardSqlite(query: SQLWrapper): SQL {
  const chunks = [...query.getSQL().queryChunks];
  const at = chunks.findIndex((c) => c instanceof StringChunk && /\bselect\b/i.test(c.value.join("")));
  const head = at < 0 ? undefined : (chunks[at] as StringChunk).value.join("");
  if (head === undefined || !/^\s*insert\b/i.test(chunks[0] instanceof StringChunk ? chunks[0].value.join("") : "")) {
    throw new Error("onlyIfPreviousChanged requires an INSERT ... SELECT query");
  }
  const text = chunks.map((c) => (c instanceof StringChunk ? c.value.join("") : "")).join(" ");
  if (/\b(on\s+conflict|returning)\b/i.test(text)) {
    throw new Error("guarded items must be a plain INSERT ... SELECT without ON CONFLICT/RETURNING");
  }
  const cut = head.search(/\bselect\b/i);
  return sql.join(
    [
      ...chunks.slice(0, at),
      sql.raw(`${head.slice(0, cut)}SELECT * FROM (${head.slice(cut)}`),
      ...chunks.slice(at + 1),
      sql.raw(") WHERE changes() = 1"),
    ],
    sql.raw(""),
  );
}

export function readAffected(dialect: Dialect, res: unknown): number {
  const n =
    dialect === "pg"
      ? (res as { count?: unknown } | null | undefined)?.count
      : (res as [{ affectedRows?: unknown }] | null | undefined)?.[0]?.affectedRows;
  if (typeof n !== "number") throw new Error("atomic: cannot read affected row count from driver result");
  return n;
}

/** All items commit together or none do. D1 has no interactive transactions, so sqlite uses db.batch. */
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
    return any.batch(stmts);
  }
  return any.transaction(async (tx: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const results: unknown[] = [];
    let prev: unknown;
    let skipped = false;
    for (const item of build(tx)) {
      const guarded = isGuarded(item);
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
