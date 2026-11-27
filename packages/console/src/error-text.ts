const DEFAULT_FALLBACK = "Something went wrong. Try again."

// The server's fixed copy maps to plain words; anything unknown (a network failure, a 500) gets the fallback, never the raw text.
export function createErrorText(copy: Record<string, string>, fallback = DEFAULT_FALLBACK) {
  const map = new Map(Object.entries(copy))
  return {
    errorText: (err: unknown): string => map.get(err instanceof Error ? err.message : "") ?? fallback,
    reasonText: (code: string | null): string | null => (code ? (map.get(code) ?? fallback) : null),
  }
}

export const isNotFound = (err: unknown): boolean => err instanceof Error && err.message === "not found"
