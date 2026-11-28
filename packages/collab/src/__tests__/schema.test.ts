import { buildTables } from "@foundry/database/factory"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { describe, expect, it } from "vitest"
import { collabTables, DEFAULT_LINK_TTL_SECONDS, EXPIRY_PRESETS } from "../schema"

describe("collab schema", () => {
  it("builds both tables for sqlite", () => {
    const t = buildTables(collabTables, "sqlite")
    const docs = getTableConfig(t.collabDocs)
    const shares = getTableConfig(t.collabShares)
    expect([docs.name, shares.name]).toEqual(["collab_docs", "collab_shares"])
    const col = (cfg: typeof docs, name: string) => cfg.columns.find((c) => c.name === name)
    for (const name of ["snapshot", "text", "default_link_ttl_seconds"]) expect(col(docs, name)).toBeDefined()
    expect(col(shares, "expires_at")?.notNull).toBe(true)
    expect(col(shares, "token_hash")?.notNull).toBe(true)
    expect(col(docs, "default_link_ttl_seconds")?.default).toBe(604800)
  })

  it("presets match the owner decision", () => {
    expect(EXPIRY_PRESETS.map((p) => p.seconds)).toEqual([3600, 86400, 604800, 2592000])
    expect(DEFAULT_LINK_TTL_SECONDS).toBe(604800)
  })
})
