import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const tokens = readFileSync(join(root, "../themes/src/tokens.css"), "utf8")
const read = (p: string) => readFileSync(join(root, p), "utf8")

describe("press scale is a token so admin can drop it and customer keeps it", () => {
  it("admin scope sets both press tokens to 1", () => {
    const admin = tokens.slice(tokens.indexOf(".admin-ui, body"))
    expect(admin).toMatch(/--ui-press-scale: 1;/)
    expect(admin).toMatch(/--ui-press-scale-nav: 1;/)
  })

  it(":root keeps the customer press values", () => {
    expect(tokens).toMatch(/--ui-press-scale: 0\.97;/)
    expect(tokens).toMatch(/--ui-press-scale-nav: 0\.96;/)
  })

  it("shared press sites read the token, not a literal scale", () => {
    expect(read("src/date-range-picker.tsx")).toContain("active:scale-(--ui-press-scale)")
    expect(read("../design-system/src/filters/facet-filters.tsx")).toContain("active:scale-(--ui-press-scale)")
    expect(read("../design-system/src/bottom-nav.tsx")).toContain("active:scale-(--ui-press-scale-nav)")
    expect(read("../design-system/src/bottom-nav.tsx")).not.toMatch(/active:scale-\[/)
  })

  it("admin-only row actions carry no press or hover motion", () => {
    const rowActions = read("../design-system/src/row-actions.tsx")
    expect(rowActions).not.toMatch(/active:scale-|group-hover\/row:scale-|transition-\[transform/)
  })
})
