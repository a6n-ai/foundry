import { FSA_NAMES } from "./fsa-names";
import { normalizePostal } from "./zones";

export type PostalArea = {
  /** "Etobicoke", "Queen's Park Ontario Provincial Government", or "Downtown Toronto, Central Toronto" for a short prefix. */
  name: string;
  /** The neighbourhoods GeoNames lists in brackets for one FSA; null for short prefixes. */
  neighbourhoods: string | null;
};

const split = (raw: string) => {
  const m = raw.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { name: m[1]!, neighbourhoods: m[2]! } : { name: raw, neighbourhoods: null };
};

/**
 * Name of the area a postal prefix covers. A full postal code or a three-character FSA
 * resolves to that FSA; a shorter prefix ("M8", "L5") lists the most common area names
 * across the FSAs under it. Null when nothing matches (non-Canadian or unknown).
 */
export function postalArea(prefix: string, maxNames = 3): PostalArea | null {
  const p = normalizePostal(prefix);
  if (p.length >= 3) {
    const raw = FSA_NAMES[p.slice(0, 3)];
    return raw ? split(raw) : null;
  }
  if (!p) return null;
  const counts = new Map<string, number>();
  for (const [fsa, raw] of Object.entries(FSA_NAMES)) {
    if (!fsa.startsWith(p)) continue;
    const { name } = split(raw);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const names = [...counts].sort((a, b) => b[1] - a[1]).slice(0, maxNames).map(([n]) => n);
  return { name: names.join(", "), neighbourhoods: null };
}
