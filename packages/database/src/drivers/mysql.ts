import { drizzle } from "drizzle-orm/mysql2";

export function connectMysql(urlOrHyperdrive: string | { connectionString: string }, schema: Record<string, unknown>) {
  const url = typeof urlOrHyperdrive === "string" ? urlOrHyperdrive : urlOrHyperdrive.connectionString;
  return drizzle(url, { schema, mode: "default" });
}
