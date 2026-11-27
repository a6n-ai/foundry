// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

const dir = new URL(".", import.meta.url).pathname
// Covers `from "x"`, side-effect `import "x"` and dynamic `import("x")`.
const banned = /(from|import)\s*\(?\s*["'](next(\/|["'])|@tanstack\/|@foundry\/(design-system|crm)\b)/

it("the banned pattern catches every import form", () => {
  for (const line of [
    `import Link from "next/link"`,
    `import "next/font"`,
    `const m = await import("@tanstack/react-router")`,
    `export { x } from '@tanstack/query'`,
    `import { Shell } from "@foundry/crm"`,
    `import { Card } from "@foundry/design-system/card"`,
    `import x from "next"`,
  ]) {
    expect(line).toMatch(banned)
  }
  expect(`import { Button } from "@foundry/ui/button"`).not.toMatch(banned)
  expect(`import { nextPage } from "./nextish"`).not.toMatch(banned)
})

it("imports no next, @tanstack, design-system or crm module", () => {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f))
  expect(files.length).toBeGreaterThan(0)
  for (const f of files) {
    if (f === "boundary.test.ts") continue
    expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(banned)
  }
})
