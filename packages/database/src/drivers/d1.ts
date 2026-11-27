import { drizzle } from "drizzle-orm/d1";

// Minimal structural type: @cloudflare/workers-types is not installed in this package.
export type D1Database = { prepare: (...a: any[]) => any; batch: (...a: any[]) => any };

export function connectD1(binding: D1Database, schema: Record<string, unknown>) {
  return drizzle(binding as never, { schema });
}
