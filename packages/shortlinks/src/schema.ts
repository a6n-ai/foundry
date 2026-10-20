import { baseColumns } from "@foundry/database";
import { pgTable, text } from "drizzle-orm/pg-core";

/**
 * A short code that redirects to a path inside the same app (`/q/K7M2QX` → `/subscribe?…`).
 * A plain table: nothing here references app tables (`created_by` carries no FK, as in
 * `baseColumns`), so an app re-exports it from its schema barrel and drizzle-kit generates
 * that app's migration.
 */
export const shortLinks = pgTable("short_links", {
  ...baseColumns("lnk"),
  code: text("code").notNull().unique(),
  // Always an in-app path ("/…"), never a URL: see assertInAppPath.
  target: text("target").notNull(),
});

export type ShortLinksTable = typeof shortLinks;
