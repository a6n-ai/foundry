import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Versioned AES-256-GCM envelope for secrets stored in tenant config blobs. Server-only. */
export type Envelope = { v: 1; iv: string; tag: string; ct: string };

const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyBytes(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes (base64)");
  return key;
}

export function seal(plain: string, keyB64: string, context: string): Envelope {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyB64), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

export function open(env: Envelope, keyB64: string, context: string): string {
  const iv = Buffer.from(env.iv, "base64");
  const tag = Buffer.from(env.tag, "base64");
  if (iv.length !== IV_BYTES) throw new Error("Envelope IV must be 12 bytes");
  if (tag.length !== TAG_BYTES) throw new Error("Envelope tag must be 16 bytes");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyB64), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]).toString("utf8");
}

export function isEnvelope(x: unknown): x is Envelope {
  const e = x as Envelope | null;
  return !!e && e.v === 1 && typeof e.iv === "string" && typeof e.tag === "string" && typeof e.ct === "string";
}

export function generateKeyB64(): string {
  return randomBytes(32).toString("base64");
}

/**
 * A secret stored AES-GCM sealed under the app's master key. `context` binds the envelope to
 * its field, so a token pasted into another plugin's slot cannot be opened there.
 */
export function sealedSecret(context: string, masterKey: () => string | null | undefined) {
  const key = () => masterKey()?.trim() || null;
  return {
    /** Null when the server has no master key: the caller must refuse to store the secret. */
    seal(plain: string): Envelope | null {
      const k = key();
      return k ? seal(plain, k, context) : null;
    },
    /** Null when unset, the key is missing, or the key changed since it was sealed. */
    open(env: Envelope | null | undefined): string | null {
      const k = key();
      if (!env || !k) return null;
      try {
        return open(env, k, context);
      } catch {
        return null;
      }
    },
    hasKey: () => key() != null,
  };
}
export type SealedSecret = ReturnType<typeof sealedSecret>;
