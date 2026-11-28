import { signToken, verifyToken } from "@foundry/commons/signed-token"

export type RoomClaims = {
  doc: string
  sub: string
  name: string
  edit: boolean
  share: string | null
  /** Share expiry in ms; null for staff. */
  until: number | null
}

export const ROOM_TOKEN_TTL_SECONDS = 300

export function signRoomToken(
  secret: string,
  claims: RoomClaims,
  ttlSeconds = ROOM_TOKEN_TTL_SECONDS,
  now = Date.now(),
): Promise<string> {
  return signToken(secret, claims, ttlSeconds, now)
}

export async function verifyRoomToken(secret: string, token: string, now = Date.now()): Promise<RoomClaims | null> {
  const p = await verifyToken<RoomClaims>(secret, token, now)
  if (!p) return null
  const strings = [p.doc, p.sub, p.name].every((v) => typeof v === "string")
  return strings && typeof p.edit === "boolean" ? p : null
}

export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}
