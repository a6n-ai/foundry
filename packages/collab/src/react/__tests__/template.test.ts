import { describe, expect, it } from "vitest"
import { CURSOR_COLORS, colorFor } from "../colors"
import { meetingTemplate } from "../template"

describe("meetingTemplate", () => {
  it("meeting template has the five sections in order", () => {
    const blocks = meetingTemplate({ title: "Meeting with Ana - 2026-11-28", attendees: ["Ana", "Sam"] })
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "heading",
      "bulletListItem",
      "bulletListItem",
      "heading",
      "numberedListItem",
      "heading",
      "paragraph",
      "heading",
      "checkListItem",
    ])
    expect(blocks[0]).toMatchObject({ props: { level: 1 }, content: "Meeting with Ana - 2026-11-28" })
  })
})

describe("colorFor", () => {
  it("colorFor is deterministic", () => {
    expect(colorFor("u1")).toBe(colorFor("u1"))
    expect(CURSOR_COLORS).toContain(colorFor("guest:csh_1:ana"))
  })
})
