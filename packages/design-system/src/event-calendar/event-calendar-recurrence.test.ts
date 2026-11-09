import { describe, expect, it } from "vitest"
import { expandRecurrence } from "./event-calendar-recurrence"

const range = { start: new Date("2026-06-01T00:00:00Z"), end: new Date("2026-07-01T00:00:00Z") }
const ctx = { timeZone: "UTC" }
const hour = 3_600_000

describe("expandRecurrence ordinal pre-count", () => {
  it("is capped by MAX_ITERATIONS for a DTSTART decades before the range", () => {
    const start = new Date("1900-01-01T09:00:00Z")
    const t0 = Date.now()
    const out = expandRecurrence(
      { id: "e", title: "old", start, end: new Date(start.getTime() + hour), recurrence: { freq: "daily", byWeekday: ["MO"] } },
      range,
      ctx
    )
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(out).toEqual([])
  })

  it("still counts exactly for a series old enough to stay under the cap", () => {
    const start = new Date("2000-01-01T09:00:00Z")
    const out = expandRecurrence(
      { id: "e", title: "monthly", start, end: new Date(start.getTime() + hour), recurrence: { freq: "monthly", byMonthDay: [1] } },
      range,
      ctx
    )
    expect(out).toHaveLength(1)
    expect(out[0].recurrenceIndex).toBe(26 * 12 + 5)
  })
})
