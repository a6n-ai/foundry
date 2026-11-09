"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clampView, frameOf, zoomAt, type Pad, type View } from "./frame";
import { CHIP, hits, labelBox, placeLabels, type Box } from "./labels";
export type { Box } from "./labels";
import { projector, UNITS_PER_KM, type LatLng, type RegionBox, type XY } from "./project";

export type Region = {
  box: RegionBox; width: number; height: number;
  shields: (XY & { ref: string })[];
  waterLabels?: { name: string; spots: number[][] }[];
  /** The low-detail ring around the box, in map units (it starts left of and above 0). */
  outer?: { x: number; y: number; w: number; h: number };
  districts: string[];
};
export type MapPlace = LatLng & { id: string; name: string; group?: number };
/** A filled district; `place` ties it to a place, so hovering either lights both. */
export type MapDistrict = { id: string; group?: number; place?: string };

const PAD = 36;
const SHIELD_H = 18;

/**
 * Our own drawn map: the region's water, roads, rail, rivers and districts come from one static SVG
 * (`src`), referenced with <use>, so the page carries no geometry and the browser caches the file.
 * It is fetched only once the map is near the viewport. Places, names, shields and the pin are
 * placed in px over it. Everything is data: add or remove a place or a district and the map follows.
 * Colours are the --rm-* tokens in region-map.css.
 */
export function RegionMap({
  src,
  region,
  places,
  districts = [],
  focus = null,
  pin = null,
  rings = [],
  pad,
  label,
  className,
  children,
  picked = null,
  onPick,
  activeGroup = null,
  onHover,
  blocked,
}: {
  src: string;
  region: Region;
  places: MapPlace[];
  districts?: MapDistrict[];
  focus?: string | null;
  pin?: (LatLng & { served: boolean }) | null;
  rings?: { center: LatLng; radiusKm: number }[];
  /** Px kept clear on each side (a floating panel, say), from the map's width. */
  pad?: (width: number) => Pad;
  label: string;
  className?: string;
  children?: ReactNode;
  picked?: string | null;
  /** Every district is tappable when set, filled or not: "do you come here?" in one tap. */
  onPick?: (districtId: string) => void;
  /** One group (a delivery window, say) to stand out: its districts stay bright, the rest fade. */
  activeGroup?: number | null;
  onHover?: (districtId: string | null) => void;
  /** Px boxes the app draws over the map (a panel, a legend), kept clear of names and shields. */
  blocked?: (width: number, height: number) => Box[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [near, setNear] = useState(false);
  const [hot, setHot] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e!.contentRect;
      setSize((s) => (s && Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: Math.round(width), h: Math.round(height) }));
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => { if (e!.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  const P = projector(region.box);
  const at = (p: LatLng) => P.at(p);
  const pts = [...places.map(at), ...(pin ? [at(pin)] : [])];
  const base = size && pts.length ? frameOf(pts, size.w, size.h, pad ? pad(size.w) : { top: PAD, right: PAD, bottom: PAD, left: PAD }, { bounds: { w: region.width, h: region.height } }) : null;
  const [cam, setCam] = useState<View | null>(null);
  const view = base && cam ? cam : base;
  const drag = useRef<{ x: number; y: number; from: View; moved: boolean } | null>(null);
  const moved = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; from: View } | null>(null);
  const ring = region.outer ?? { x: 0, y: 0, w: region.width, h: region.height };
  const limits = base && size ? { min: Math.min(base.scale, size.w / ring.w, size.h / ring.h), max: base.scale * 8 } : null;
  const bounds = ring;
  const zoom = (factor: number, x = (size?.w ?? 0) / 2, y = (size?.h ?? 0) / 2) => {
    if (!view || !limits) return;
    setCam(clampView(zoomAt(view, factor, x, y, limits), bounds));
  };
  // A plain wheel zooms only after the map was clicked (and until the pointer leaves it), so scrolling
  // the page past the map never gets caught. A trackpad pinch (ctrl+wheel) always zooms.
  const engaged = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !engaged.current) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomRef.current?.(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
    };
    const leave = () => { engaged.current = false; };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("pointerleave", leave); };
  }, []);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const px = (q: XY) => ({ x: (q.x - view!.x) * view!.scale, y: (q.y - view!.y) * view!.scale });

  const byId = new Map(districts.map((d) => [d.id, d]));

  let marks: ReactNode = null;
  if (view && size) {
    const compact = size.w < 600;
    const chip = compact ? CHIP.compact : CHIP.regular;
    const spots = places.map((p) => ({ name: p.name, ...px(at(p)) }));
    const controls: Box[] = [{ l: size.w - 60, r: size.w, t: 0, b: 12 + 40 * 3 + 8 }, ...(blocked?.(size.w, size.h) ?? [])];
    const sides = placeLabels(spots, chip, { w: size.w, h: size.h }, controls);
    const taken: Box[] = [...controls, ...spots.map((s) => ({ l: s.x - 9, r: s.x + 9, t: s.y - 9, b: s.y + 9 })), ...spots.flatMap((s, i) => (sides[i] === "none" ? [] : [labelBox(s, sides[i] as Exclude<(typeof sides)[number], "none">, chip)]))];
    const shields = region.shields.flatMap((sh) => {
      const q = px(sh);
      const w = sh.ref.length * 7 + 12;
      const b = { l: q.x - w / 2, r: q.x + w / 2, t: q.y - SHIELD_H / 2, b: q.y + SHIELD_H / 2 };
      if (b.l < 4 || b.t < 4 || b.r > size.w - 4 || b.b > size.h - 4 || taken.some((t) => hits(t, b))) return [];
      taken.push(b);
      return [{ ...sh, ...q }];
    });
    const lakes = (region.waterLabels ?? []).flatMap((l) => {
      const w = l.name.length * 8 + 8;
      for (const [x = 0, y = 0] of l.spots) {
        const q = px({ x, y });
        const b = { l: q.x - w / 2, r: q.x + w / 2, t: q.y - 10, b: q.y + 10 };
        if (b.l < 8 || b.t < 8 || b.r > size.w - 8 || b.b > size.h - 8 || taken.some((t) => hits(t, b))) continue;
        taken.push(b);
        return [{ name: l.name, ...q }];
      }
      return [];
    });
    marks = (
      <>
        {lakes.map((l) => <span key={l.name} className="rm-water-label" style={{ left: l.x, top: l.y }}>{l.name}</span>)}
        {shields.map((s) => <span key={`${s.ref}-${s.x}`} className="rm-shield" style={{ left: s.x, top: s.y }}>{s.ref}</span>)}
        {places.map((p, i) => (
          <span key={p.id} className="rm-place" data-on={String(p.id === focus || p.id === hot)} onPointerEnter={() => setHot(p.id)} onPointerLeave={() => setHot(null)} data-side={sides[i]} data-group={p.group} style={{ left: spots[i]!.x, top: spots[i]!.y }}>
            <i /><b>{p.name}</b>
          </span>
        ))}
        {pin ? (() => { const q = px(at(pin)); return <span className="rm-pin" data-served={String(pin.served)} style={{ left: q.x, top: q.y }} />; })() : null}
      </>
    );
  }

  return (
    <div
      ref={box}
      className={className ? `rm ${className}` : "rm"}
      data-compact={size ? String(size.w < 600) : undefined}
      data-zoomed={cam ? "" : undefined}
      data-active={activeGroup ?? undefined}
      onPointerDown={(e) => {
        if ((e.target as Element).closest("button, a, .rm-legend") || !view) return;
        engaged.current = true;
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.current.size === 2) {
          const [a, b] = [...touches.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, from: view };
          drag.current = null;
          moved.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
        moved.current = false;
        // One finger scrolls the page until the map is zoomed in; a mouse always drags.
        if (e.pointerType === "touch" && !cam) return;
        // No pointer capture yet: a press that never moves must still click the district under it.
        drag.current = { x: e.clientX, y: e.clientY, from: view, moved: false };
      }}
      onPointerMove={(e) => {
        if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pz = pinch.current;
        if (pz && touches.current.size >= 2 && limits) {
          const [a, b] = [...touches.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
          const r = e.currentTarget.getBoundingClientRect();
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const zoomed = zoomAt(pz.from, Math.hypot(a.x - b.x, a.y - b.y) / pz.dist, pz.mid.x - r.left, pz.mid.y - r.top, limits);
          setCam(clampView({ ...zoomed, x: zoomed.x - (mid.x - pz.mid.x) / zoomed.scale, y: zoomed.y - (mid.y - pz.mid.y) / zoomed.scale }, bounds));
          return;
        }
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
        d.moved = moved.current = true;
        setCam(clampView({ ...d.from, x: d.from.x - dx / d.from.scale, y: d.from.y - dy / d.from.scale }, bounds));
      }}
      onPointerUp={(e) => { touches.current.delete(e.pointerId); if (touches.current.size < 2) pinch.current = null; drag.current = null; }}
      onPointerCancel={(e) => { touches.current.delete(e.pointerId); pinch.current = null; drag.current = null; }}
    >
      <span className="rm-sr">{label}</span>
      {view && near ? (
        <svg className="rm-svg" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMinYMin meet" aria-hidden>
          {region.outer ? (
            <>
              {/* The ring is drawn only outside the detailed box, so its coarse lines never double the fine ones. */}
              <clipPath id="rm-ring"><path clipRule="evenodd" d={`M${ring.x} ${ring.y}h${ring.w}v${ring.h}h${-ring.w}z M0 0v${region.height}h${region.width}v${-region.height}z`} /></clipPath>
              <g clipPath="url(#rm-ring)">
                <use href={`${src}#outer-water`} className="rm-water" />
                <use href={`${src}#outer-shore`} className="rm-shore" />
                <use href={`${src}#outer-highway`} className="rm-casing" />
                <use href={`${src}#outer-highway`} className="rm-highway" />
              </g>
            </>
          ) : null}
          {region.districts.map((id) => {
            const d = byId.get(id);
            const lit = d?.place != null && (d.place === hot || d.place === focus);
            return (
              <use
                key={id}
                href={`${src}#d-${id}`}
                className={d ? "rm-district" : "rm-district-off"}
                data-group={d?.group}
                data-hot={lit ? "" : undefined}
                data-dim={activeGroup != null && d?.group !== activeGroup ? "" : undefined}
                data-picked={id === picked ? "" : undefined}
                data-pick={onPick ? "" : undefined}
                onPointerEnter={() => { if (d?.place) setHot(d.place); onHover?.(id); }}
                onPointerLeave={() => { if (d?.place) setHot(null); onHover?.(null); }}
                onClick={onPick ? () => { if (!moved.current) onPick(id); } : undefined}
              />
            );
          })}
          <use href={`${src}#water`} className="rm-water" />
          <use href={`${src}#shore`} className="rm-shore" />
          <use href={`${src}#islands`} className="rm-island" />
          <use href={`${src}#rivers`} className="rm-river" />
          <use href={`${src}#rail`} className="rm-rail" />
          <use href={`${src}#primary`} className="rm-primary" />
          <use href={`${src}#trunk`} className="rm-casing" />
          <use href={`${src}#highway`} className="rm-casing" />
          <use href={`${src}#trunk`} className="rm-trunk" />
          <use href={`${src}#highway`} className="rm-highway" />
          {picked ? <use href={`${src}#d-${picked}`} className="rm-picked" /> : null}
          {rings.map((r, i) => <polygon key={i} className="rm-ring" points={circle(r.center, r.radiusKm).map((p) => { const q = at(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ")} />)}
        </svg>
      ) : null}
      {near ? marks : null}
      {view ? (
        <div className="rm-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.6)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.6)} disabled={!!limits && view.scale <= limits.min * 1.001}>−</button>
          {cam ? <button type="button" aria-label="Reset the map" onClick={() => setCam(null)}>⟲</button> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function circle(center: LatLng, km: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    out.push({ lng: center.lng + (km / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(a), lat: center.lat + (km / 110.57) * Math.cos(a) });
  }
  return out;
}

export function RegionLegend({ groups, active = null, onPick, className }: { groups: string[]; active?: number | null; onPick?: (group: number) => void; className?: string }) {
  if (groups.length === 0) return null;
  return (
    <ul className={className ? `rm-legend ${className}` : "rm-legend"}>
      {groups.map((g, i) => (
        <li key={g} data-group={i} data-on={i === active ? "" : undefined} data-off={active != null && i !== active ? "" : undefined}>
          {onPick ? <button type="button" aria-pressed={i === active} onClick={() => onPick(i)}><i />{g}</button> : <><i />{g}</>}
        </li>
      ))}
    </ul>
  );
}

export { UNITS_PER_KM };
