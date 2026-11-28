import { c, check, defineTable, index, unique } from "@foundry/database/factory"
import { sql } from "drizzle-orm"
import { DEFAULT_LINK_TTL_SECONDS } from "./limits"

export * from "./limits"

const collabDocs = defineTable(
  "collab_docs",
  {
    ...c.updatable("cdc"),
    organizationId: c.ref("organization_id").notNull(),
    ownerRef: c.string("owner_ref").notNull(),
    title: c.string("title", 200).notNull(),
    // shortcut: base64 text, not blob, because @foundry/database has no binary column; add one if snapshots outgrow 1 MB
    snapshot: c.text("snapshot"),
    text: c.text("text"),
    defaultLinkTtlSeconds: c.int("default_link_ttl_seconds").notNull().default(DEFAULT_LINK_TTL_SECONDS),
  },
  (t) => [index("collab_docs_owner_idx").on(t.organizationId, t.ownerRef)],
)

const collabShares = defineTable(
  "collab_shares",
  {
    ...c.updatable("csh"),
    docId: c.ref("doc_id").notNull().references(() => collabDocs.columns.id, { onDelete: "cascade" }),
    tokenHash: c.string("token_hash", 64).notNull(),
    mode: c.string("mode", 8).notNull(),
    expiresAt: c.time("expires_at").notNull(),
    revokedAt: c.time("revoked_at"),
  },
  (t) => [
    unique("collab_shares_token_hash_uq").on(t.tokenHash),
    index("collab_shares_doc_idx").on(t.docId),
    check("collab_shares_mode_ck", () => sql`mode in ('edit','view')`),
  ],
)

export const collabTables = { collabDocs, collabShares }
