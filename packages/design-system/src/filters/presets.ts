import type { FacetDef } from "./facet";

export type FilterPreset = { key: string; label: string; params: Readonly<Record<string, string>> };

type Params = { get(name: string): string | null };

export function facetFields(spec: readonly FacetDef[]): string[] {
  return spec.flatMap((f) => (f.kind === "search" || f.kind === "dateRange" ? [] : [f.field]));
}

/**
 * Keys a preset owns: the list's facet params plus every key any preset sets. Applying a preset clears
 * all of them first, so a chip always lands on exactly its own view instead of stacking on stale picks.
 */
export function managedKeys(presets: readonly FilterPreset[], fields: readonly string[]): string[] {
  return [...new Set([...fields, ...presets.flatMap((p) => Object.keys(p.params))])];
}

export function applyPreset(current: URLSearchParams, preset: FilterPreset | null, managed: readonly string[]): URLSearchParams {
  const sp = new URLSearchParams(current);
  for (const k of managed) sp.delete(k);
  sp.delete("page");
  for (const [k, v] of Object.entries(preset?.params ?? {})) sp.set(k, v);
  return sp;
}

export function activePresetKey(current: Params, presets: readonly FilterPreset[], managed: readonly string[]): string | null {
  return presets.find((p) => managed.every((k) => (p.params[k] ?? null) === current.get(k)))?.key ?? null;
}
