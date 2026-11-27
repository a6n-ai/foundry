import { describe, expect, it } from "vitest"
import { withParam } from "./search-param"

describe("withParam", () => {
  it("empty value removes key and reset keys", () => {
    expect(withParam({ q: "a", page: 2 }, "q", "", ["page"])).toEqual({})
  })

  it("sets a value", () => {
    expect(withParam({}, "q", "acme", [])).toEqual({ q: "acme" })
  })

  it("keeps other keys", () => {
    expect(withParam({ view: "mine", page: 2 }, "q", "x", ["page"])).toEqual({ view: "mine", q: "x" })
  })
})
