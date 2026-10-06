import { ValidationError } from "@foundry/commons";

// Same shape the better-auth username plugin enforces; usernames are stored
// lowercased (the unique key) with the typed casing kept for display.
const RULE = /^[a-zA-Z0-9_.]{3,30}$/;
export const USERNAME_RULE_MESSAGE = "Username must be 3–30 characters: letters, numbers, _ or .";

export function normalizeUsername(raw: string): { username: string; displayUsername: string } {
  const v = raw.trim().replace(/^@/, "");
  if (!RULE.test(v)) throw new ValidationError(USERNAME_RULE_MESSAGE);
  return { username: v.toLowerCase(), displayUsername: v };
}

/** A starting username from a display name: ASCII slug (max 20) + 4 digits. */
export function suggestUsername(
  name: string | null | undefined,
  rand: () => number = () => 1000 + Math.floor(Math.random() * 9000),
): string {
  const base = (name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  return `${base.length >= 3 ? base : "user"}${rand()}`;
}
