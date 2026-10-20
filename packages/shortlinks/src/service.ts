import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@foundry/database";
import { shortLinks } from "./schema";

// No 0/O, 1/I/L: codes get read aloud and retyped from WhatsApp screenshots.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
// 31^8 ≈ 8.5e11 codes: a link can carry a coupon code, so guessing one has to be impractical
// without a rate limiter (10k live links → ~85M requests per hit). Still short to read out.
const CODE_LENGTH = 8;
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
 * app's domain. Control characters are refused outright (browsers drop tabs and newlines, so
 * "/<tab>/evil.test" would become "//evil.test"); what is left must parse to the same origin
 * as a fixed base, which rules out absolute URLs, "//host" and "/\host". The path is returned
 * rebuilt from the parsed URL, so what gets stored is what the browser would follow.
 */
const BASE = "https://app.invalid";
export function assertInAppPath(target: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(target) || target.length > 2000 || !target.startsWith("/")) {
    throw new Error(`short link target must be an in-app path, got "${target.slice(0, 40)}"`);
  }
  const url = new URL(target, BASE);
  if (url.origin !== BASE || target.startsWith("//") || target.startsWith("/\\")) {
    throw new Error(`short link target must be an in-app path, got "${target.slice(0, 40)}"`);
  }
  return url.pathname + url.search + url.hash;
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
