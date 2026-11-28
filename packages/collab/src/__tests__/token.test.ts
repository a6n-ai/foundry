import { signToken } from "@foundry/commons/signed-token"
import { describe, expect, it } from "vitest"
import { hashShareToken, newShareToken, signRoomToken, verifyRoomToken, type RoomClaims } from "../token"

const claims: RoomClaims = { doc: "cdc_1", sub: "u1", name: "Ana", edit: true, share: null, until: null }
const now = 1_700_000_000_000

describe("room token", () => {
  it("room token round-trips claims", async () => {
    const t = await signRoomToken("s", claims, undefined, now)
    expect(await verifyRoomToken("s", t, now)).toEqual({ ...claims, e: Math.floor(now / 1000) + 300 })
  })

  it("room token expires after 300 s", async () => {
    const t = await signRoomToken("s", claims, undefined, now)
    expect(await verifyRoomToken("s", t, now + 301_000)).toBeNull()
  })

  it("room token missing edit is refused", async () => {
    const t = await signToken("s", { doc: "cdc_1", sub: "u1", name: "Ana" }, 300, now)
    expect(await verifyRoomToken("s", t, now)).toBeNull()
  })
})

describe("share token", () => {
  it("share token is 43 base64url chars and unique", () => {
    const a = newShareToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(newShareToken()).not.toBe(a)
  })

  it("share hash is stable 64-char hex", async () => {
    const t = newShareToken()
    const h = await hashShareToken(t)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashShareToken(t)).toBe(h)
    expect(h).not.toBe(t)
  })
})
