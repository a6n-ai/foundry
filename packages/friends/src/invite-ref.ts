import { createHmac, timingSafeEqual } from "node:crypto";

// `<username>-<12 hex>`: readable, but only the app can mint the suffix, so a
// username seen in search is not enough to force a friendship.
export const INVITE_REF_RE = /^([a-z0-9_.]{3,30})-([0-9a-f]{12})$/;

function sign(secret: string, userId: bigint): string {
  return createHmac("sha256", secret).update(`friend-invite:${userId}`).digest("hex").slice(0, 12);
}

export function makeInviteRef(secret: string, userId: bigint, username: string): string {
  return `${username.toLowerCase()}-${sign(secret, userId)}`;
}

export function parseInviteRef(ref: string): { username: string; verify: (secret: string, userId: bigint) => boolean } | null {
  const m = INVITE_REF_RE.exec(ref.trim().toLowerCase());
  if (!m) return null;
  const [, username, sig] = m;
  return {
    username: username!,
    verify: (secret, userId) => timingSafeEqual(Buffer.from(sign(secret, userId)), Buffer.from(sig!)),
  };
}
