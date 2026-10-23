import type { Channel, RealtimeRole } from "./index";

export type RealtimeTokenPayload = { c: Channel; u: string; r: RealtimeRole; e: number };

// WebCrypto only: runs in Node 20+ and Cloudflare Workers (no node:crypto/Buffer).
const enc = new TextEncoder();

const b64url = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

export async function signRealtimeToken(
  secret: string,
  p: { channel: Channel; userId: string; role: RealtimeRole },
  ttlSeconds = 60,
  now = Date.now(),
): Promise<string> {
  const payload: RealtimeTokenPayload = {
    c: p.channel,
    u: p.userId,
    r: p.role,
    e: Math.floor(now / 1000) + ttlSeconds,
  };
  const part = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(part));
  return `${part}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyRealtimeToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<RealtimeTokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [part, sig] = parts as [string, string];
    // subtle.verify compares in constant time
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64url(sig), enc.encode(part));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64url(part))) as RealtimeTokenPayload;
    if (typeof p.e !== "number" || Math.floor(now / 1000) > p.e) return null;
    return p;
  } catch {
    return null;
  }
}
