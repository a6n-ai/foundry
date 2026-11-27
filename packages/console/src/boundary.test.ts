// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

const dir = new URL(".", import.meta.url).pathname
const banned = /from ["'](next|next\/[^"']*|@tanstack\/[^"']*)["']/

it("imports no next or @tanstack module", () => {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f))
  expect(files.length).toBeGreaterThan(0)
  for (const f of files) {
    if (f === "boundary.test.ts") continue
    expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(banned)
  }
})
