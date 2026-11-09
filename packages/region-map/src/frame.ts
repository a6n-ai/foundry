import type { XY } from "./project";

export type Pad = { top: number; right: number; bottom: number; left: number };
export type View = { x: number; y: number; w: number; h: number; scale: number };

/**
 * The viewBox that fits `points` (map units) inside a `width` x `height` px box minus `pad`,
 * keeping the box's aspect. `maxScale` (px per unit) stops one or two close points zooming in
 * to street level; `bounds` keeps the view on the drawn region where it can.
 */
export function frameOf(points: XY[], width: number, height: number, pad: Pad, { maxScale = 2, bounds }: { maxScale?: number; bounds?: { w: number; h: number } } = {}): View {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const availW = Math.max(width - pad.left - pad.right, 40), availH = Math.max(height - pad.top - pad.bottom, 40);
  const scale = Math.min(maxScale, availW / Math.max(maxX - minX, 1e-6), availH / Math.max(maxY - minY, 1e-6));
  const w = width / scale, h = height / scale;
  let x = (minX + maxX) / 2 - (pad.left + availW / 2) / scale;
  let y = (minY + maxY) / 2 - (pad.top + availH / 2) / scale;
  if (bounds) {
    if (w <= bounds.w) x = Math.min(Math.max(x, 0), bounds.w - w);
    if (h <= bounds.h) y = Math.min(Math.max(y, 0), bounds.h - h);
  }
  return { x, y, w, h, scale };
}

/** `view` zoomed by `factor` about the px point (px, py), which stays put on screen, with the
 *  scale held between `min` and `max` px per unit. */
export function zoomAt(view: View, factor: number, px: number, py: number, { min, max }: { min: number; max: number }): View {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const ux = view.x + px / view.scale, uy = view.y + py / view.scale;
  return { x: ux - px / scale, y: uy - py / scale, w: (view.w * view.scale) / scale, h: (view.h * view.scale) / scale, scale };
}

/** Keeps at least half the view over the drawn region, so a drag can't lose the map. */
export function clampView(view: View, bounds: { x?: number; y?: number; w: number; h: number }): View {
  const bx = bounds.x ?? 0, by = bounds.y ?? 0;
  const x = Math.min(Math.max(view.x, bx - view.w / 2), bx + bounds.w - view.w / 2);
  const y = Math.min(Math.max(view.y, by - view.h / 2), by + bounds.h - view.h / 2);
  return { ...view, x, y };
}
