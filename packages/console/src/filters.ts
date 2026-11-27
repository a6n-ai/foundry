import type { ConsoleSearch } from "./router"

export type Facet = { key: string; label: string; options: { value: string; label: string }[] }
export type Chip = { key: string; label: string; valueLabel: string }

export function chipsFrom(search: ConsoleSearch, facets: Facet[]): Chip[] {
  return facets.flatMap((f) => {
    const v = search[f.key]
    if (typeof v !== "string" || !v) return []
    return [{ key: f.key, label: f.label, valueLabel: f.options.find((o) => o.value === v)?.label ?? v }]
  })
}

export function withoutKey(search: ConsoleSearch, key: string): ConsoleSearch {
  const { [key]: _dropped, ...rest } = search
  return rest
}
