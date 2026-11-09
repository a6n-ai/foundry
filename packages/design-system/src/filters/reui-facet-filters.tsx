"use client";

import { useCallback, useMemo, useState, type ComponentType } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useListNav } from "../use-list-nav";
import type { FacetDef, Option } from "./facet";
import { DateRangePicker } from "@foundry/ui/date-range-picker";
import {
  Filters,
  type Filter,
  type FilterFieldConfig,
  type CustomRendererProps,
} from "./reui/filters";

// The bridge speaks two value shapes: strings (select/pills/multi option
// values) and numbers (dateRange epoch-ms). One union keeps reui's generic
// happy without per-field casts.
type Val = string | number;

const SELECT_OP = "is";
const MULTI_OP = "is_any_of";
const DATE_OP = "between";

const csv = (raw: string | null): string[] =>
  raw ? raw.split(",").filter(Boolean) : [];

const num = (v: string | null): number | undefined =>
  v ? Number(v) : undefined;

function mapOptions(options: Option[]) {
  return options.map((o) => ({ value: String(o.value), label: o.label }));
}

export type DateFieldProps = {
  label: string;
  from?: number;
  to?: number;
  timeZone?: string;
  onChange: (r: { from?: number; to?: number }) => void;
};

function DateFacetRenderer(label: string, timeZone: string | undefined, DateField: ComponentType<DateFieldProps>) {
  return function render({ values, onChange }: CustomRendererProps<Val>) {
    const from = typeof values[0] === "number" ? (values[0] as number) : undefined;
    const to = typeof values[1] === "number" ? (values[1] as number) : undefined;
    return (
      <DateField
        label={label}
        from={from}
        to={to}
        timeZone={timeZone}
        onChange={(r) =>
          onChange(
            [r.from, r.to].filter((v): v is number => v != null) as Val[],
          )
        }
      />
    );
  };
}

export function ReuiFacetFilters({
  spec,
  hideDate = false,
  pinned = [],
  clearValues,
  timeZone,
  DateField = DateRangePicker,
  oneChipPerField = false,
}: {
  spec: FacetDef[];
  /** The page owns the date picker, so this menu must not also write `from`/`to`. */
  hideDate?: boolean;
  /** Facet fields always shown as chips (empty until picked). Also relabels the add button "More filters". */
  pinned?: readonly string[];
  /** When a select/pills facet is cleared, write this sentinel instead of deleting the param (e.g. `{ ending: "off" }`). */
  clearValues?: Readonly<Record<string, string>>;
  /** IANA zone the picked days mean. Defaults to the browser's. */
  timeZone?: string;
  DateField?: ComponentType<DateFieldProps>;
  /** A second pick of the same field replaces the first instead of adding a duplicate chip. */
  oneChipPerField?: boolean;
}) {
  const nav = useListNav();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = useMemo(
    () => (hideDate ? spec.filter((f) => f.kind !== "dateRange") : spec),
    [spec, hideDate],
  );

  const fields = useMemo<FilterFieldConfig<Val>[]>(() => {
    return view.flatMap((f): FilterFieldConfig<Val>[] => {
      if (f.kind === "search") return [];
      if (f.kind === "dateRange") {
        return [
          {
            key: f.field,
            label: f.label,
            type: "custom",
            operators: [{ value: DATE_OP, label: "between" }],
            defaultOperator: DATE_OP,
            customRenderer: DateFacetRenderer(f.label, timeZone, DateField),
          },
        ];
      }
      if (f.kind === "pills" || f.kind === "select") {
        return [
          {
            key: f.field,
            label: f.label,
            type: "select",
            operators: [{ value: SELECT_OP, label: "is" }],
            defaultOperator: SELECT_OP,
            options: mapOptions(f.options),
            searchable: f.kind === "select",
          },
        ];
      }
      const parentVals = f.dependsOn ? csv(params.get(f.dependsOn)) : [];
      const options =
        f.dependsOn && parentVals.length
          ? f.options.filter(
              (o) => o.parent == null || parentVals.includes(o.parent),
            )
          : f.options;
      return [
        {
          key: f.field,
          label: f.label,
          type: "multiselect",
          operators: [{ value: MULTI_OP, label: "is any of" }],
          defaultOperator: MULTI_OP,
          options: mapOptions(options),
        },
      ];
    });
  }, [view, params, timeZone, DateField]);

  // reui finds the filter it is building by the id it minted. Re-deriving with
  // id=field broke that, so every multi-select pick replaced the last one.
  const [ids, setIds] = useState<Record<string, string>>({});
  // Chips added from the menu with no value yet; the URL can't hold them.
  const [pending, setPending] = useState<Filter<Val>[]>([]);
  // The URL lags a transition behind each pick. Until it moves, show what reui
  // just sent so a second quick pick builds on the first.
  const urlKey = params.toString();
  const [optimistic, setOptimistic] = useState<{ key: string; filters: Filter<Val>[] } | null>(null);
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const withPinned = useCallback(
    (list: Filter<Val>[]): Filter<Val>[] => {
      const out = [...list];
      for (const f of view) {
        if (f.kind === "search" || !pinnedSet.has(f.field) || out.some((x) => x.field === f.field)) continue;
        const operator = f.kind === "dateRange" ? DATE_OP : f.kind === "multi" ? MULTI_OP : SELECT_OP;
        out.push({ id: ids[f.field] ?? f.field, field: f.field, operator, values: [] });
      }
      const order = (x: Filter<Val>) => {
        const i = pinned.indexOf(x.field);
        return i >= 0 ? i : pinned.length;
      };
      return out.sort((a, b) => order(a) - order(b));
    },
    [view, pinned, pinnedSet, ids],
  );

  const derived = useMemo<Filter<Val>[]>(() => {
    const out: Filter<Val>[] = [];
    const push = (field: string, operator: string, values: Val[]) =>
      out.push({ id: ids[field] ?? field, field, operator, values });
    for (const f of view) {
      if (f.kind === "search") continue;
      if (f.kind === "dateRange") {
        const from = num(params.get("from"));
        const to = num(params.get("to"));
        if (from != null || to != null) push(f.field, DATE_OP, [from, to].filter((v): v is number => v != null));
        continue;
      }
      if (f.kind === "multi") {
        const values = csv(params.get(f.field));
        if (values.length) push(f.field, MULTI_OP, values);
        continue;
      }
      const v = params.get(f.field);
      if (v && v !== clearValues?.[f.field]) push(f.field, SELECT_OP, [v]);
    }
    for (const p of pending) if (!out.some((x) => x.field === p.field)) out.push(p);
    return out;
  }, [view, params, clearValues, pending, ids]);

  const filters = withPinned(optimistic?.key === urlKey ? optimistic.filters : derived);

  const onChange = (next: Filter<Val>[]) => {
    setIds((prev) => ({ ...prev, ...Object.fromEntries(next.map((n) => [n.field, n.id])) }));
    setPending(next.filter((n) => n.values.length === 0 && !pinnedSet.has(n.field)));
    setOptimistic({ key: urlKey, filters: next });
    const sp = new URLSearchParams(params.toString());
    const byField = new Map(next.map((n) => [n.field, n]));

    for (const f of view) {
      if (f.kind === "search") continue;
      if (f.kind === "dateRange") {
        const hit = byField.get(f.field);
        const from = hit && typeof hit.values[0] === "number" ? hit.values[0] : undefined;
        const to = hit && typeof hit.values[1] === "number" ? hit.values[1] : undefined;
        if (from != null) sp.set("from", String(from));
        else sp.delete("from");
        if (to != null) sp.set("to", String(to));
        else sp.delete("to");
        continue;
      }
      const hit = byField.get(f.field);
      const values = (hit?.values ?? []).map(String).filter(Boolean);
      if (f.kind === "multi") {
        if (values.length) sp.set(f.field, values.join(","));
        else sp.delete(f.field);
      } else {
        if (values.length) sp.set(f.field, values[0]);
        else if (clearValues?.[f.field] != null) sp.set(f.field, clearValues[f.field]);
        else sp.delete(f.field);
      }
    }

    sp.delete("page"); // any filter change resets to page 0
    nav(`${pathname}?${sp.toString()}`);
  };

  return (
    <Filters<Val>
      filters={filters}
      fields={fields}
      onChange={onChange}
      size="sm"
      showSearchInput={false}
      allowMultiple={!oneChipPerField}
      i18n={pinned.length ? { addFilter: "More filters" } : undefined}
    />
  );
}
