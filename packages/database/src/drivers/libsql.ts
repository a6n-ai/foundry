import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export function connectLibsql(url: string, schema: Record<string, unknown>) {
  return drizzle(createClient({ url }), { schema });
}
