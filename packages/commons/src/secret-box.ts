import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Versioned AES-256-GCM envelope for secrets stored in tenant config blobs. Server-only. */
export type Envelope = { v: 1; iv: string; tag: string; ct: string };

function keyBytes(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes (base64)");
  return key;
}

export function seal(plain: string, keyB64: string): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyB64), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

export function open(env: Envelope, keyB64: string): string {
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyB64), Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]).toString("utf8");
}

export function isEnvelope(x: unknown): x is Envelope {
  const e = x as Envelope | null;
  return !!e && e.v === 1 && typeof e.iv === "string" && typeof e.tag === "string" && typeof e.ct === "string";
}

export function generateKeyB64(): string {
  return randomBytes(32).toString("base64");
}
