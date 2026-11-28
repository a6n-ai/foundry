import { signToken, verifyToken } from "@foundry/commons/signed-token";
import type { Channel, RealtimeRole } from "./index";

export type RealtimeTokenPayload = { c: Channel; u: string; r: RealtimeRole; e: number };

export function signRealtimeToken(
  secret: string,
  p: { channel: Channel; userId: string; role: RealtimeRole },
  ttlSeconds = 300,
  now = Date.now(),
): Promise<string> {
  return signToken(secret, { c: p.channel, u: p.userId, r: p.role }, ttlSeconds, now);
}

export function verifyRealtimeToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<RealtimeTokenPayload | null> {
  return verifyToken<Omit<RealtimeTokenPayload, "e">>(secret, token, now);
}
