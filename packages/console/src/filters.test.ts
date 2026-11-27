import { describe, expect, it } from "vitest"
import { chipsFrom, withoutKey } from "./filters"

const facets = [{ key: "stage", label: "Stage", options: [{ value: "won", label: "Won" }] }]

describe("filters", () => {
  it("chipsFrom labels set facets", () => {
    expect(chipsFrom({ stage: "won" }, facets)).toEqual([{ key: "stage", label: "Stage", valueLabel: "Won" }])
    expect(chipsFrom({ stage: "" }, facets)).toEqual([])
  })

  it("withoutKey drops only that key", () => {
    expect(withoutKey({ stage: "won", page: 2, q: "a" }, "stage")).toEqual({ page: 2, q: "a" })
  })
})
