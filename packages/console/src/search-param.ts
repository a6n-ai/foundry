import type { ConsoleSearch } from "./router"

export function withParam(prev: ConsoleSearch, key: string, value: string, reset: string[]): ConsoleSearch {
  const next = { ...prev }
  delete next[key]
  for (const k of reset) delete next[k]
  const v = value.trim()
  return v ? { ...next, [key]: v } : next
}
