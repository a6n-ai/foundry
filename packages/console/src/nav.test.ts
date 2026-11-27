import { describe, expect, it } from "vitest"
import { activeItem, type NavGroup } from "./nav"

describe("activeItem", () => {
  it("longest prefix wins", () => {
    const groups: NavGroup[] = [{ items: [{ label: "A", to: "/inquiries" }, { label: "B", to: "/inquiries/unassigned" }] }]
    expect(activeItem(groups, "/inquiries/unassigned")?.label).toBe("B")
  })

  it("exact item ignores child paths", () => {
    const groups: NavGroup[] = [{ items: [{ label: "Home", to: "/", exact: true }] }]
    expect(activeItem(groups, "/team")).toBeUndefined()
    expect(activeItem(groups, "/")?.label).toBe("Home")
  })
})
