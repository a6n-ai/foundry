export type Side = "top" | "bottom" | "right" | "left";
export type Box = { l: number; r: number; t: number; b: number };
export type Chip = { charW: number; pad: number; h: number };

export const CHIP: Record<"regular" | "compact", Chip> = { regular: { charW: 7.4, pad: 22, h: 27 }, compact: { charW: 6.8, pad: 18, h: 25 } };
const GAP = 10; // dot centre to chip edge

export function labelBox(p: { name: string; x: number; y: number }, side: Side, c: Chip): Box {
  const w = p.name.length * c.charW + c.pad;
  if (side === "right" || side === "left") {
    const l = side === "right" ? p.x + GAP : p.x - GAP - w;
    return { l, r: l + w, t: p.y - c.h / 2, b: p.y + c.h / 2 };
  }
  const t = side === "top" ? p.y - GAP - c.h : p.y + GAP;
  return { l: p.x - w / 2, r: p.x + w / 2, t, b: t + c.h };
}

export const hits = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** Each name sits above its dot unless that overlaps a placed name or another dot; then below, right
 *  or left. A name never leaves `bounds`. With no room anywhere it is "none" (the caller still names
 *  it some other way). Top-down, so the higher dot keeps the top spot. Points are in px. */
export function placeLabels(points: { name: string; x: number; y: number }[], chip: Chip = CHIP.regular, bounds?: { w: number; h: number }, blocked: Box[] = []): (Side | "none")[] {
  const order = points.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x);
  const placed: Box[] = [...blocked];
  const dots: Box[] = points.map((p) => ({ l: p.x - 9, r: p.x + 9, t: p.y - 9, b: p.y + 9 }));
  const out: (Side | "none")[] = new Array(points.length);
  for (const { p, i } of order) {
    const inside = (box: Box) => !bounds || (box.l >= 4 && box.t >= 4 && box.r <= bounds.w - 4 && box.b <= bounds.h - 4);
    const clear = (box: Box) => inside(box) && !placed.some((q) => hits(box, q)) && !dots.some((d, j) => j !== i && hits(box, d));
    const side = (["top", "bottom", "right", "left"] as const).find((sd) => clear(labelBox(p, sd, chip))) ?? "none";
    out[i] = side;
    if (side !== "none") placed.push(labelBox(p, side, chip));
  }
  return out;
}
