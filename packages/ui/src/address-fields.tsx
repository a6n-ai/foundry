"use client";

import { useEffect, useRef, useState, type ComponentType, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import {
  ADDRESS_FIELD_AUTOCOMPLETE,
  ADDRESS_FIELD_LABELS,
  ADDRESS_FIELD_PLACEHOLDERS,
  ADDRESS_FIELD_PRESETS,
  CANADIAN_PROVINCES,
  NO_PROVINCE,
  type AddressFieldKey,
  type AddressFieldPreset,
  type AddressValues,
} from "@foundry/commons";
import { cn } from "./cn";
import { Input } from "./input";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const FULL_WIDTH_FIELDS = new Set<AddressFieldKey>(["addressLine", "fullName", "deliveryInstructions"]);

const DEBOUNCE_MS = 250;

// Local shapes for the resolve/suggest API responses — kept minimal here
// instead of depending on @foundry/places (a server-flavored package) from
// this floor-layer package.
export type AddressSuggestion = { placeId: string; label: string };
export type ResolvedPlaceFields = {
  lat: number;
  lng: number;
  addressLine?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type AddressFieldsProps = {
  values: AddressValues;
  onChange: (patch: Partial<AddressValues>) => void;
  preset?: AddressFieldPreset;
  fields?: readonly AddressFieldKey[];
  idPrefix?: string;
  errors?: Partial<Record<AddressFieldKey, string>>;
  disabled?: boolean;
  className?: string;
  /** Rendered after the postal code row (e.g. zone check button / served banner). */
  postalSlot?: ReactNode;
  onPostalBlur?: () => void;
  /**
   * When `resolveUrl` is supplied, the address-line field becomes a debounced
   * autocomplete: typing calls `${resolveUrl}/../suggest`-shaped suggest
   * endpoint (see `suggestUrl`), picking a suggestion resolves it. `onResolve`
   * is optional — pass it only if the caller needs the resolved coordinates.
   * Omit `resolveUrl` to keep today's plain input.
   */
  onResolve?: (place: { lat: number; lng: number }) => void;
  /** App's resolve API route (POST { placeId, address } -> { place }). */
  resolveUrl?: string;
  /** App's suggest API route (POST { query } -> { suggestions }). Defaults to
   *  `resolveUrl` with its last path segment swapped for "suggest". */
  suggestUrl?: string;
  /** Restyle with the app's own primitives; defaults to the shadcn kit. */
  ui?: Partial<AddressUi>;
};

function resolveFields(preset: AddressFieldPreset | undefined, fields: readonly AddressFieldKey[] | undefined) {
  return fields ?? ADDRESS_FIELD_PRESETS[preset ?? "profile"];
}

export function deriveSuggestUrl(resolveUrl: string): string {
  return resolveUrl.replace(/\/[^/]+$/, "/suggest");
}

/** Props every text-input slot receives; spread `inputProps` on the native input. */
export type AddressFieldSlotProps = {
  id: string;
  label: string;
  error?: string;
  /** Spans both grid columns (address line, full name, instructions). */
  wide: boolean;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  /** Spinner + suggestion list, to render inside a `relative` wrapper around the input. */
  overlay?: ReactNode;
  /** True when `overlay` is present, i.e. the input needs a positioning wrapper. */
  combo?: boolean;
  /** Rendered after the error (postal slot). */
  footer?: ReactNode;
};

export type AddressSelectSlotProps = {
  id: string;
  label: string;
  error?: string;
  wide: boolean;
  disabled: boolean;
  placeholder: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

export type AddressSuggestionsSlotProps = {
  id: string;
  items: AddressSuggestion[];
  activeIndex: number;
  optionId: (s: AddressSuggestion) => string;
  onPick: (s: AddressSuggestion) => void;
};

/** Primitives AddressFields draws with. Apps pass a subset; defaults are the shadcn kit. */
export type AddressUi = {
  Field: ComponentType<AddressFieldSlotProps>;
  Select: ComponentType<AddressSelectSlotProps>;
  Suggestions: ComponentType<AddressSuggestionsSlotProps>;
  /** In-input loading indicator; a kit without one passes `() => null`. */
  Spinner: ComponentType;
};

function DefaultField({ id, label, error, wide, inputProps, overlay, combo, footer }: AddressFieldSlotProps) {
  return (
    <div className={cn("grid gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {combo ? (
        <div className="relative">
          <Input id={id} {...inputProps} />
          {overlay}
        </div>
      ) : (
        <Input id={id} {...inputProps} />
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {footer ? <div className="sm:col-span-2">{footer}</div> : null}
    </div>
  );
}

function DefaultSelect({ id, label, error, wide, disabled, placeholder, value, options, onChange }: AddressSelectSlotProps) {
  return (
    <div className={cn("grid gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DefaultSuggestions({ id, items, activeIndex, optionId, onPick }: AddressSuggestionsSlotProps) {
  return (
    <ul
      id={id}
      role="listbox"
      className="absolute z-10 mt-1 w-full rounded-lg bg-popover p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-4px_rgba(0,0,0,0.15)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,0,0,0.5)]"
    >
      {items.map((suggestion, i) => (
        <li
          key={suggestion.placeId}
          id={optionId(suggestion)}
          role="option"
          aria-selected={i === activeIndex}
          className={cn(
            "cursor-pointer rounded px-2 py-1.5 text-sm transition-colors",
            i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
          )}
          // onMouseDown (not onClick) fires before the input's onBlur, so
          // the pick registers before the dropdown closes itself away.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(suggestion);
          }}
        >
          {suggestion.label}
        </li>
      ))}
    </ul>
  );
}

function DefaultSpinner() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
    />
  );
}

export const defaultAddressUi: AddressUi = { Field: DefaultField, Select: DefaultSelect, Suggestions: DefaultSuggestions, Spinner: DefaultSpinner };

/** Description of one field to draw, produced by `useAddressFields`. */
export type AddressFieldRow =
  | { kind: "province"; key: "province"; id: string; label: string; error?: string; wide: boolean; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[] }
  | { kind: "line"; key: "addressLine"; id: string; label: string; error?: string; wide: boolean; value: string; onChange: (v: string) => void; onResolve: (p: ResolvedPlaceFields) => void }
  | { kind: "text"; key: AddressFieldKey; id: string; label: string; error?: string; wide: boolean; value: string; onChange: (v: string) => void; isPostal: boolean; autoComplete?: string; placeholder?: string; onBlur?: () => void };

export type UseAddressFieldsOptions = Pick<
  AddressFieldsProps,
  "values" | "onChange" | "preset" | "fields" | "idPrefix" | "errors" | "onPostalBlur" | "onResolve" | "resolveUrl" | "suggestUrl"
>;

/**
 * Headless logic behind AddressFields: which fields, ids, values, patches and
 * autofill-on-resolve. Draw the rows with any UI kit.
 */
export function useAddressFields({
  values,
  onChange,
  preset = "profile",
  fields,
  idPrefix = "address",
  errors = {},
  onPostalBlur,
  onResolve,
  resolveUrl,
  suggestUrl,
}: UseAddressFieldsOptions) {
  const rows: AddressFieldRow[] = resolveFields(preset, fields).map((key): AddressFieldRow => {
    const id = `${idPrefix}-${key}`;
    const base = { id, error: errors[key], wide: FULL_WIDTH_FIELDS.has(key) };
    if (key === "province") {
      return {
        ...base,
        kind: "province",
        key,
        label: ADDRESS_FIELD_LABELS.province,
        value: values.province ?? "",
        onChange: (v) => onChange({ province: v === NO_PROVINCE ? "" : v }),
        options: [{ value: NO_PROVINCE, label: "No province" }, ...CANADIAN_PROVINCES],
      };
    }
    if (key === "addressLine" && resolveUrl) {
      return {
        ...base,
        kind: "line",
        key,
        label: ADDRESS_FIELD_LABELS.addressLine,
        value: values.addressLine ?? "",
        onChange: (v) => onChange({ addressLine: v }),
        onResolve: ({ lat, lng, ...structured }) => {
          onChange(structured);
          onResolve?.({ lat, lng });
        },
      };
    }
    const isPostal = key === "postalCode";
    return {
      ...base,
      kind: "text",
      key,
      label: ADDRESS_FIELD_LABELS[key],
      value: values[key] ?? "",
      onChange: (v) => onChange({ [key]: v }),
      isPostal,
      autoComplete: ADDRESS_FIELD_AUTOCOMPLETE[key],
      placeholder: ADDRESS_FIELD_PLACEHOLDERS[key],
      onBlur: isPostal ? onPostalBlur : undefined,
    };
  });
  return { rows, suggestUrl: resolveUrl ? (suggestUrl ?? deriveSuggestUrl(resolveUrl)) : undefined };
}

export function AddressFields({ className, disabled = false, postalSlot, ui, resolveUrl, ...rest }: AddressFieldsProps) {
  const { Field, Select } = resolveAddressUi(ui);
  const { rows, suggestUrl } = useAddressFields({ ...rest, resolveUrl });
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {rows.map((row) => {
        if (row.kind === "province") {
          const { id, label, error, wide, value, options, onChange } = row;
          return <Select key={row.key} {...{ id, label, error, wide, value, options, onChange }} placeholder="Select province" disabled={disabled} />;
        }
        if (row.kind === "line") {
          return (
            <AddressLineField
              key={row.key}
              id={row.id}
              label={row.label}
              error={row.error}
              wide={row.wide}
              value={row.value}
              disabled={disabled}
              resolveUrl={resolveUrl!}
              suggestUrl={suggestUrl!}
              onChange={row.onChange}
              onResolve={row.onResolve}
              ui={ui}
            />
          );
        }
        return (
          <Field
            key={row.key}
            id={row.id}
            label={row.label}
            error={row.error}
            wide={row.wide}
            footer={row.isPostal ? postalSlot : undefined}
            inputProps={{
              autoComplete: row.autoComplete,
              placeholder: row.placeholder,
              className: row.isPostal ? "tabular-nums" : undefined,
              value: row.value,
              disabled,
              onChange: (e) => row.onChange(e.target.value),
              onBlur: row.onBlur,
            }}
          />
        );
      })}
    </div>
  );
}

export function resolveAddressUi(ui?: Partial<AddressUi>): AddressUi {
  return ui ? { ...defaultAddressUi, ...ui } : defaultAddressUi;
}

/**
 * Headless address-line autocomplete: 250ms debounce, stale-response guard,
 * arrow/Enter/Escape keyboard, resolve-on-pick.
 */
export function useAddressAutocomplete({
  id,
  onChange,
  onResolve,
  resolveUrl,
  suggestUrl,
}: {
  id: string;
  onChange: (value: string) => void;
  onResolve: (place: ResolvedPlaceFields) => void;
  resolveUrl: string;
  suggestUrl: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a stale response (from an earlier keystroke) landing after a
  // newer one and clobbering the dropdown with outdated suggestions.
  const requestIdRef = useRef(0);
  const listId = `${id}-suggestions`;
  const optionId = (s: AddressSuggestion) => `${id}-option-${s.placeId}`;
  const activeId = activeIndex >= 0 ? optionId(suggestions[activeIndex]!) : undefined;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleFetch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      requestIdRef.current++;
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const res = await fetch(suggestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const body = (await res.json().catch(() => null)) as { suggestions?: AddressSuggestion[] } | null;
        if (requestId !== requestIdRef.current) return;
        const next = body?.suggestions ?? [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(-1);
      } catch {
        // A failed typeahead request is silent — the plain input still submits.
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  async function pick(suggestion: AddressSuggestion) {
    onChange(suggestion.label);
    requestIdRef.current++;
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setLoading(false);
    try {
      const res = await fetch(resolveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: suggestion.label, placeId: suggestion.placeId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { place?: ResolvedPlaceFields | null }
        | null;
      if (body?.place) onResolve(body.place);
    } catch {
      // A failed resolve leaves lat/lng unset — the typed address still submits.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        void pick(suggestions[activeIndex]!);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return {
    suggestions,
    open: open && suggestions.length > 0,
    activeIndex,
    loading,
    listId,
    optionId,
    activeId,
    pick,
    onKeyDown,
    onBlur: () => setOpen(false),
    onInputChange: (v: string) => {
      onChange(v);
      scheduleFetch(v);
    },
  };
}

export function AddressLineField({
  id,
  label = ADDRESS_FIELD_LABELS.addressLine,
  error,
  wide = false,
  value,
  disabled,
  resolveUrl,
  suggestUrl,
  onChange,
  onResolve,
  ui,
}: {
  id: string;
  label?: string;
  error?: string;
  wide?: boolean;
  value: string;
  disabled?: boolean;
  resolveUrl: string;
  suggestUrl: string;
  onChange: (value: string) => void;
  onResolve: (place: ResolvedPlaceFields) => void;
  ui?: Partial<AddressUi>;
}) {
  const { Field, Suggestions, Spinner } = resolveAddressUi(ui);
  const a = useAddressAutocomplete({ id, onChange, onResolve, resolveUrl, suggestUrl });
  return (
    <Field
      id={id}
      label={label}
      error={error}
      wide={wide}
      combo
      inputProps={{
        autoComplete: ADDRESS_FIELD_AUTOCOMPLETE.addressLine,
        placeholder: ADDRESS_FIELD_PLACEHOLDERS.addressLine,
        value,
        disabled,
        role: "combobox",
        "aria-expanded": a.open,
        "aria-autocomplete": "list",
        "aria-controls": a.listId,
        "aria-activedescendant": a.activeId,
        className: a.loading ? "pr-8" : undefined,
        onChange: (e) => a.onInputChange(e.target.value),
        onKeyDown: a.onKeyDown,
        onBlur: a.onBlur,
      }}
      overlay={
        <>
          {a.loading ? <Spinner /> : null}
          {a.open ? (
            <Suggestions id={a.listId} items={a.suggestions} activeIndex={a.activeIndex} optionId={a.optionId} onPick={(s) => void a.pick(s)} />
          ) : null}
        </>
      }
    />
  );
}

/** Bare input + dropdown (no label/error chrome), for callers that supply their own, e.g. react-hook-form's FormItem. */
export function AddressLineAutocomplete({
  id,
  value,
  disabled,
  resolveUrl,
  suggestUrl,
  onChange,
  onResolve,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  resolveUrl: string;
  suggestUrl: string;
  onChange: (value: string) => void;
  onResolve: (place: ResolvedPlaceFields) => void;
}) {
  const a = useAddressAutocomplete({ id, onChange, onResolve, resolveUrl, suggestUrl });
  return (
    <div className="relative">
      <Input
        id={id}
        autoComplete={ADDRESS_FIELD_AUTOCOMPLETE.addressLine}
        placeholder={ADDRESS_FIELD_PLACEHOLDERS.addressLine}
        value={value}
        disabled={disabled}
        role="combobox"
        aria-expanded={a.open}
        aria-autocomplete="list"
        aria-controls={a.listId}
        aria-activedescendant={a.activeId}
        className={a.loading ? "pr-8" : undefined}
        onChange={(e) => a.onInputChange(e.target.value)}
        onKeyDown={a.onKeyDown}
        onBlur={a.onBlur}
      />
      {a.loading ? <DefaultSpinner /> : null}
      {a.open ? (
        <DefaultSuggestions id={a.listId} items={a.suggestions} activeIndex={a.activeIndex} optionId={a.optionId} onPick={(x) => void a.pick(x)} />
      ) : null}
    </div>
  );
}
