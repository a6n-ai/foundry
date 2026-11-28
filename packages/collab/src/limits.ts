// No imports: the React entry reads this without pulling drizzle into the browser bundle.
export const LIMITS = {
  snapshotBytes: 1_000_000,
  textChars: 200_000,
  messageBytes: 262_144,
  // one keystroke is a doc update plus awareness messages, so a fast typist sends 20+ a second
  messagesPerWindow: 600,
  windowMs: 10_000,
} as const

/** BlockNote's default fragment name; the editor and the server both use it. */
export const FRAGMENT = "document-store"

export const EXPIRY_PRESETS = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
] as const

export const DEFAULT_LINK_TTL_SECONDS = 604800

export const MAX_LINK_TTL_MS = 365 * 86_400_000
