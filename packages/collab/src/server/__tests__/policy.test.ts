import { describe, expect, it } from "vitest"
import { RateWindow, Throttle } from "../policy"

const now = 1_000_000

describe("RateWindow", () => {
  it("rate window allows max then refuses", () => {
    const w = new RateWindow(3, 1000)
    expect([1, 2, 3, 4].map(() => w.hit("a", now))).toEqual([true, true, true, false])
    expect(w.hit("a", now + 1001)).toBe(true)
  })

  it("rate window keys are independent", () => {
    const w = new RateWindow(1, 1000)
    expect(w.hit("a", now)).toBe(true)
    expect(w.hit("a", now)).toBe(false)
    expect(w.hit("b", now)).toBe(true)
  })
})

describe("Throttle", () => {
  it("throttle allows once per window", () => {
    const t = new Throttle(600_000)
    expect(t.allow("a", now)).toBe(true)
    expect(t.allow("a", now + 1)).toBe(false)
    expect(t.allow("a", now + 600_001)).toBe(true)
  })
})
