"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";

const SERIAL_PX = 48;
const ID_PX = 144;
export const ID_KEY = "__id";

const INTRINSIC = new Set(["w-px", "w-0", "w-auto", "w-fit", "w-min", "w-max"]);

function tailwindPx(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const step = token.match(/^w-(\d+)$/);
  if (step) return Number(step[1]) * 4;
  const arb = token.match(/^w-\[(\d+(?:\.\d+)?)px\]$/);
  if (arb) return Math.round(Number(arb[1]));
  return undefined;
}

export function defaultColumnPx(c: { key: string; width?: string }, kindWidth: Record<string, string>): number {
  return tailwindPx(c.width && !INTRINSIC.has(c.width) ? c.width : undefined)
    ?? tailwindPx(kindWidth[c.key])
    ?? 180;
}

function floorPx(start: number): number {
  return Math.min(start, 72);
}

export function headStyle(px: number, locked: boolean): CSSProperties {
  return locked
    ? { width: px, minWidth: px, maxWidth: px }
    : { width: px, minWidth: px };
}

export function ColumnResizer({
  label, onPointerDown, onPointerMove, onPointerUp,
}: {
  label: string;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label ? `Resize ${label}` : "Resize column"}
      className="absolute inset-y-0 right-0 z-40 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:bg-border after:opacity-0 hover:after:opacity-100"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function useColumnLayout(
  columns: readonly { key: string; width?: string }[],
  kindWidth: Record<string, string>,
  hasId: boolean,
  serial: boolean,
) {
  const pathname = usePathname();
  // String identity, not the array: some tables build `columns` inline each render.
  const signature = `${hasId}|${columns.map((c) => `${c.key}:${c.width ?? ""}`).join(",")}`;
  const keys = useMemo(() => {
    void signature;
    return [...(hasId ? [ID_KEY] : []), ...columns.map((c) => c.key)];
  }, [signature, hasId, columns]);
  const defaults = useMemo(() => {
    void signature;
    const d: Record<string, number> = {};
    if (hasId) d[ID_KEY] = ID_PX;
    for (const c of columns) d[c.key] = defaultColumnPx(c, kindWidth);
    return d;
  }, [signature, hasId, kindWidth, columns]);
  const storageKey = `realm.admin-table.cols:${pathname}:${signature}`;
  const [locked, setLocked] = useState<Record<string, number> | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number; min: number; snapshot: Record<string, number> } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setLocked(null);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, number> = {};
      let any = false;
      for (const k of keys) {
        const v = parsed[k];
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          out[k] = v;
          any = true;
        } else {
          out[k] = defaults[k] ?? 180;
        }
      }
      setLocked(any ? out : null);
    } catch {
      setLocked(null);
    }
  }, [storageKey, keys, defaults]);

  const widthOf = useCallback(
    (key: string) => locked?.[key] ?? defaults[key] ?? 180,
    [locked, defaults],
  );

  const measure = useCallback((e: ReactPointerEvent) => {
    const table = (e.currentTarget as HTMLElement).closest("table");
    const cells = table?.tHead?.rows[0]?.cells;
    const offset = serial ? 1 : 0;
    const snap: Record<string, number> = {};
    keys.forEach((k, i) => {
      const cell = cells?.[i + offset];
      const seen = cell ? Math.round(cell.getBoundingClientRect().width) : (defaults[k] ?? 180);
      snap[k] = Math.max(floorPx(defaults[k] ?? seen), seen);
    });
    return snap;
  }, [serial, keys, defaults]);

  const onPointerDown = useCallback((key: string) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const snapshot = measure(e);
    drag.current = {
      key,
      startX: e.clientX,
      startW: snapshot[key] ?? defaults[key] ?? 180,
      min: floorPx(defaults[key] ?? 72),
      snapshot,
    };
  }, [measure, defaults]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = Math.max(d.min, Math.round(d.startW + (e.clientX - d.startX)));
    setLocked({ ...d.snapshot, [d.key]: next });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setLocked((prev) => {
      if (prev) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(prev));
        } catch {
          /* private mode */
        }
      }
      return prev;
    });
  }, [storageKey]);

  const resizer = useCallback((key: string, label: string) => (
    <ColumnResizer
      label={label}
      onPointerDown={onPointerDown(key)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  ), [onPointerDown, onPointerMove, onPointerUp]);

  const dataSum = keys.reduce((n, k) => n + widthOf(k), 0);
  const total = (serial ? SERIAL_PX : 0) + dataSum;
  const tableStyle: CSSProperties = locked
    ? { width: total, minWidth: total }
    : { width: "100%", minWidth: total };

  return { widthOf, locked: locked != null, tableStyle, resizer, serialPx: SERIAL_PX };
}
