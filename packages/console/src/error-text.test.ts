import { describe, expect, it } from "vitest"
import { createErrorText, isNotFound } from "./error-text"

const { errorText, reasonText } = createErrorText({ stale: "Changed by someone else, reload" }, "Try again")

describe("createErrorText", () => {
  it("maps a known code", () => {
    expect(reasonText("stale")).toBe("Changed by someone else, reload")
    expect(errorText(new Error("stale"))).toBe("Changed by someone else, reload")
  })

  it("unknown code and non-errors get the fallback", () => {
    expect(reasonText("nope")).toBe("Try again")
    expect(errorText(new Error("500 raw"))).toBe("Try again")
    expect(errorText("x")).toBe("Try again")
  })

  it("null code is null", () => {
    expect(reasonText(null)).toBeNull()
  })

  it("isNotFound", () => {
    expect(isNotFound(new Error("not found"))).toBe(true)
    expect(isNotFound(new Error("other"))).toBe(false)
  })
})
