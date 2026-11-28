import { describe, expect, it } from "vitest"
import { signToken, verifyToken } from "../signed-token"

const p = { doc: "d1", n: 2 }
const now = 1_700_000_000_000

describe("signed token", () => {
  it("round-trips a payload and adds e", async () => {
    const t = await signToken("s", p, 60, now)
    expect(await verifyToken("s", t, now)).toEqual({ ...p, e: Math.floor(now / 1000) + 60 })
  })

  it("rejects an expired token", async () => {
    const t = await signToken("s", p, 60, now)
    expect(await verifyToken("s", t, now + 61_000)).toBeNull()
  })

  it("rejects a tampered payload", async () => {
    const t = await signToken("s", p, 60, now)
    const flipped = (t[0] === "A" ? "B" : "A") + t.slice(1)
    expect(await verifyToken("s", flipped, now)).toBeNull()
  })

  it("rejects a wrong secret", async () => {
    const t = await signToken("s", p, 60, now)
    expect(await verifyToken("other", t, now)).toBeNull()
  })
})
