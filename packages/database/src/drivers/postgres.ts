import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { postgresOptions } from "../postgres-options";

export function connectPostgres(
  urlOrHyperdrive: string | { connectionString: string },
  schema: Record<string, unknown>,
) {
  const url = typeof urlOrHyperdrive === "string" ? urlOrHyperdrive : urlOrHyperdrive.connectionString;
  return drizzle(postgres(url, postgresOptions), { schema });
}
