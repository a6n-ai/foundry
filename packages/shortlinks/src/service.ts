import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@foundry/database";
import { shortLinks } from "./schema";

// No 0/O, 1/I/L: codes get read aloud and retyped from WhatsApp screenshots.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_TRIES = 5;

export function makeCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Codes are upper-case; a link typed in lower case still resolves. Anything else is not a code. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

/**
 * Only same-app paths: a short link that could point anywhere is an open redirect wearing the
 * app's domain. Rejects absolute URLs, protocol-relative `//host`, and `/\host` (browsers treat
 * a backslash like a slash).
 */
export function assertInAppPath(target: string): string {
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\") || /[\r\n]/.test(target)) {
    throw new Error(`short link target must be an in-app path, got "${target.slice(0, 40)}"`);
  }
  if (target.length > 2000) throw new Error("short link target is too long");
  return target;
}

export async function createShortLink(db: Database, input: { target: string; createdBy?: bigint | null }): Promise<string> {
  const target = assertInAppPath(input.target);
  for (let i = 0; i < MAX_TRIES; i++) {
    const code = makeCode();
    const rows = await db
      .insert(shortLinks)
      .values({ code, target, createdBy: input.createdBy ?? null })
      .onConflictDoNothing({ target: shortLinks.code })
      .returning({ code: shortLinks.code });
    if (rows.length) return code;
  }
  throw new Error("could not allocate a short link code");
}

/** The stored path for a code, or null when the code is malformed or unknown. */
export async function resolveShortLink(db: Database, rawCode: string): Promise<string | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const [row] = await db.select({ target: shortLinks.target }).from(shortLinks).where(eq(shortLinks.code, code)).limit(1);
  return row ? assertInAppPath(row.target) : null;
}
