"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@foundry/ui/toggle-group";
import { useListNav } from "../use-list-nav";
import { SearchInput } from "../search-input";
import type { FacetDef } from "./facet";
import { activePresetKey, applyPreset, facetFields, managedKeys, type FilterPreset } from "./presets";
import { ReuiFacetFilters, type DateFieldProps } from "./reui-facet-filters";

const DEFAULT_PINNED = 3;
// Record a combination only once the user stops changing filters, not every intermediate pick.
const RECORD_AFTER_MS = 2500;

export type FilterRecommendations = {
  /** The viewer's most-used combinations on this list, as chips. Keyed on the path only. */
  load: (pathname: string, spec: FacetDef[]) => Promise<FilterPreset[]>;
  /** Called once the facet combination has settled. */
  record: (pathname: string, facetQuery: string, fields: string[]) => Promise<unknown>;
};

// Single reusable slot for a server-paginated list page: the search box and
// the facet pills together, so a page can't declare a `{ kind: "search" }`
// facet (which parseFilterState already reads from ?q=) and forget to render
// the box for it — that gap is exactly what left Orders/Inquiries/Customers
// with working search wiring but no visible input. Drop this in DataTable's
// `filters` prop in place of a bare <ReuiFacetFilters>.
export function ListSearchFilters({
  spec,
  placeholder = "Search…",
  shortPlaceholder,
  debounceMs = 300,
  dateControl = "menu",
  dateSlot,
  pinned,
  clearValues,
  timeZone,
  DateField,
  oneChipPerField,
  recommendations,
}: {
  spec: FacetDef[];
  placeholder?: string;
  shortPlaceholder?: string;
  debounceMs?: number;
  /** `menu` keeps the date inside Filter. `inline` shows `dateSlot` beside search. `external` leaves it to the page. */
  dateControl?: "menu" | "inline" | "external";
  dateSlot?: ReactNode;
  /** Facet fields shown as chips up front, or a count: the first N facets in the spec. Default none. */
  pinned?: readonly string[] | number;
  /** Select/pills clear sentinels forwarded to ReuiFacetFilters (e.g. `ending=off`). */
  clearValues?: Readonly<Record<string, string>>;
  timeZone?: string;
  DateField?: ComponentType<DateFieldProps>;
  oneChipPerField?: boolean;
  /** Shows recommended-filter chips above the bar and records the viewer's combinations. */
  recommendations?: FilterRecommendations;
}) {
  const searchFacet = spec.find((f) => f.kind === "search");
  const nav = useListNav();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  // Mirrors DataTable's own internal search-query hook: merge q, and drop page
  // so a search typed while on page 2 doesn't land on an empty filtered page.
  const setQ = useCallback(
    (raw: string) => {
      // Server search ignores spacing, so a typed space or doubled gap would
      // only refetch the same rows.
      const v = raw.trim().replace(/\s+/g, " ");
      if (v === q) return;
      const sp = new URLSearchParams(params.toString());
      if (v) sp.set("q", v);
      else sp.delete("q");
      sp.delete("page");
      const qs = sp.toString();
      nav(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, nav, q],
  );

  const hasDate = spec.some((f) => f.kind === "dateRange");
  const hideDate = dateControl !== "menu" && hasDate;
  const shownPinned = useMemo(
    () =>
      typeof pinned === "object"
        ? pinned
        : spec
            .flatMap((f) => (f.kind === "search" || (hideDate && f.kind === "dateRange") ? [] : [f.field]))
            .slice(0, pinned ?? 0),
    [pinned, spec, hideDate],
  );
  const fields = useMemo(() => facetFields(spec), [spec]);

  // Recommendations load keyed on the path only; the spec is refreshed through a
  // ref so each filter change doesn't refetch.
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  useEffect(() => {
    if (!recommendations) return;
    let live = true;
    recommendations
      .load(pathname, specRef.current)
      .then((p) => live && setPresets(p))
      .catch(() => live && setPresets([]));
    return () => {
      live = false;
    };
  }, [pathname, recommendations]);

  // The settled facet combination, recorded once per change.
  const facetQuery = useMemo(() => {
    const sp = new URLSearchParams();
    for (const f of fields) {
      const v = params.get(f);
      if (v) sp.set(f, v);
    }
    return sp.toString();
  }, [fields, params]);
  const recorded = useRef("");
  useEffect(() => {
    if (!recommendations || !facetQuery || facetQuery === recorded.current) return;
    const t = setTimeout(() => {
      recorded.current = facetQuery;
      recommendations.record(pathname, facetQuery, fields).catch(() => {});
    }, RECORD_AFTER_MS);
    return () => clearTimeout(t);
  }, [facetQuery, pathname, fields, recommendations]);

  const managed = useMemo(() => managedKeys(presets, fields), [presets, fields]);
  const activePreset = activePresetKey(params, presets, managed);
  const pickPreset = (key: string) => {
    const qs = applyPreset(params, presets.find((p) => p.key === key) ?? null, managed).toString();
    nav(qs ? `${pathname}?${qs}` : pathname);
  };

  const bar = (
    <div className="flex flex-wrap items-center gap-2">
      {dateControl === "inline" && hasDate ? dateSlot : null}
      {searchFacet && (
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={placeholder}
          shortPlaceholder={shortPlaceholder}
          debounceMs={debounceMs}
        />
      )}
      <ReuiFacetFilters
        spec={spec}
        hideDate={hideDate}
        pinned={shownPinned}
        clearValues={clearValues}
        timeZone={timeZone}
        DateField={DateField}
        oneChipPerField={oneChipPerField}
      />
    </div>
  );
  if (!presets.length) return bar;

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Recommended filters"
        className="flex-wrap"
        value={activePreset ?? ""}
        // Clicking the active chip again resets to the default view.
        onValueChange={pickPreset}
      >
        {presets.map((p) => (
          <ToggleGroupItem key={p.key} value={p.key}>
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {bar}
    </div>
  );
}
