// Light enough for BlockNote's dark cursor-label text, strong enough to see on a white or dark page.
export const CURSOR_COLORS = [
  "#f87171",
  "#fb923c",
  "#eab308",
  "#4ade80",
  "#2dd4bf",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
]

export function colorFor(sub: string): string {
  let hash = 0
  for (const char of sub) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]!
}
