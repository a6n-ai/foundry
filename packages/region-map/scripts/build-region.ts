// Builds a region for <RegionMap>: one SVG of symbols (water, islands, rivers, rail, roads,
// highways, districts) the page references with <use>, and a small JSON of what the browser needs
// (box, size, highway shields, district ids). Run once per region; the app commits both files, so
// neither the build nor the page calls a map service.
//
//   node packages/region-map/scripts/build-region.ts --box -80.1,43.35,-78.7,44.1 \
//     --out ../realm/apps/tiffin-grab/public/landing/maps/gta \
//     [--outer -81.6,42.4,-77.2,45.0] [--districts fsa.geojson --district-key CFSAUID --district-match ^[LM]]
//
// Shore, roads, rail and rivers come from OpenStreetMap (Overpass API, ODbL: credit "©
// OpenStreetMap contributors" wherever the map shows). Districts come from any GeoJSON of polygons;
// Canada's postal areas (FSA) are Statistics Canada's, Open Government Licence - Canada:
//   https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/14/query
//   ?where=1=1&geometry=<w,s,e,n>&geometryType=esriGeometryEnvelope&inSR=4326&outFields=CFSAUID&outSR=4326&f=geojson
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { projector, type RegionBox, type XY } from "../src/project.ts";

type Pt = [number, number];
type Way = { tags?: Record<string, string>; role?: string; geometry: { lat: number; lon: number }[] };
type Rel = { tags?: Record<string, string>; members?: (Way & { type: string })[] };

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const [w, s, e, n] = (arg("box") ?? "").split(",").map(Number);
const out = arg("out");
if ([w, s, e, n].some((v) => v === undefined || Number.isNaN(v)) || !out) {
  console.error("usage: build-region.ts --box w,s,e,n --out <path without extension> [--districts file.geojson --district-key KEY --district-match REGEX]");
  process.exit(1);
}
const box: RegionBox = { w: w!, s: s!, e: e!, n: n! };
const P = projector(box);
const pt = (lat: number, lng: number): Pt => { const q = P.at({ lat, lng }); return [q.x, q.y]; };

async function overpass(query: string): Promise<(Way & Rel)[]> {
  const body = `data=${encodeURIComponent(`[out:json][timeout:180];${query}`)}`;
  for (const url of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "foundry-region-map" } }).catch(() => null);
      const text = res?.ok ? await res.text() : "";
      if (text.startsWith("{")) return JSON.parse(text).elements;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
  throw new Error("Overpass API did not answer");
}

function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!, [bx, by] = pts[b]!;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let best = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      const d = len ? Math.abs((px - ax) * dy - (py - ay) * dx) / len : Math.hypot(px - ax, py - ay);
      if (d > best) { best = d; at = i; }
    }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const lengthOf = (pts: Pt[]) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) : 0), 0);
const MARGIN = 20; // units past the box a line may run before it is cut
type Frame = { x0: number; y0: number; x1: number; y1: number };
const INNER: Frame = { x0: 0, y0: 0, x1: P.width, y1: P.height };
const near = ([x, y]: Pt, f: Frame = INNER) => x >= f.x0 - MARGIN && y >= f.y0 - MARGIN && x <= f.x1 + MARGIN && y <= f.y1 + MARGIN;
function runsOnMap(pts: Pt[], f: Frame = INNER): Pt[][] {
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (const p of pts) { if (near(p, f)) run.push(p); else { if (run.length > 1) runs.push(run); run = []; } }
  if (run.length > 1) runs.push(run);
  return runs;
}
const f1 = (v: number) => Math.round(v * 10) / 10;
// Whole units (100 m) as relative steps: "M120 45l3-2 5 1". A minus sign separates numbers on its
// own, and steps that round to nothing are dropped. About half the bytes of absolute decimals.
const num = (v: number, first: boolean) => (v < 0 || first ? `${v}` : ` ${v}`);
function pathOf(lines: Pt[][], closed = false) {
  return lines.map((l) => {
    let [px, py] = [Math.round(l[0]![0]), Math.round(l[0]![1])];
    let d = `M${px}${num(py, false)}`, steps = "";
    for (const [x, y] of l.slice(1)) {
      const [rx, ry] = [Math.round(x), Math.round(y)];
      if (rx === px && ry === py) continue;
      steps += num(rx - px, steps === "") + num(ry - py, false);
      [px, py] = [rx, ry];
    }
    return steps ? `${d}l${steps}${closed ? "z" : ""}` : "";
  }).join("");
}
// A ring's two ends are equal, which would collapse it to a point; simplify each half.
const ringSimplify = (pts: Pt[], tol: number) => { const m = pts.length >> 1; return [...simplify(pts.slice(0, m + 1), tol), ...simplify(pts.slice(m), tol).slice(1)]; };

// Join ways that share end points into long chains (shores and roads arrive in thousands of pieces).
// Greedy walk over an end-point index: each chain grows from both ends until no piece continues it.
function stitch(ways: Way[]) {
  const key = (g: { lat: number; lon: number }) => `${g.lat.toFixed(7)},${g.lon.toFixed(7)}`;
  const pieces = ways.map((x) => ({ a: key(x.geometry[0]!), b: key(x.geometry.at(-1)!), pts: x.geometry.map((g) => pt(g.lat, g.lon)), used: false }));
  const ends = new Map<string, number[]>();
  pieces.forEach((p, i) => { for (const k of [p.a, p.b]) ends.set(k, [...(ends.get(k) ?? []), i]); });
  const next = (k: string) => (ends.get(k) ?? []).find((i) => !pieces[i]!.used);
  const out: { closed: boolean; pts: Pt[] }[] = [];
  for (const start of pieces) {
    if (start.used) continue;
    start.used = true;
    let pts = start.pts, head = start.a, tail = start.b;
    for (let i = next(tail); i !== undefined && head !== tail; i = next(tail)) {
      const p = pieces[i]!; p.used = true;
      if (p.a === tail) { pts = [...pts, ...p.pts.slice(1)]; tail = p.b; } else { pts = [...pts, ...[...p.pts].reverse().slice(1)]; tail = p.a; }
    }
    for (let i = next(head); i !== undefined && head !== tail; i = next(head)) {
      const p = pieces[i]!; p.used = true;
      if (p.b === head) { pts = [...p.pts.slice(0, -1), ...pts]; head = p.a; } else { pts = [...[...p.pts].reverse().slice(0, -1), ...pts]; head = p.b; }
    }
    out.push({ closed: head === tail, pts });
  }
  return out;
}

const bbox = `${s},${w},${n},${e}`;
console.log("fetching shore, roads, rail and rivers from Overpass…");
// Lakes as relations, so each shore piece keeps its role: outer is shore, inner is an island.
const lakeRels = await overpass(`rel["natural"="water"]["water"!~"^(river|canal|reservoir|pond)$"](${bbox});out geom(${bbox});`);
// A clipped member has null points where it leaves the box; each run between them is its own piece.
const lakeWays = (role: string, rels = lakeRels): Way[] =>
  rels.flatMap((r) => (r.members ?? []).filter((m) => m.type === "way" && m.role === role && m.geometry?.length)).flatMap((m) => {
    const pieces: Way[] = [];
    let run: Way["geometry"] = [];
    for (const g of m.geometry) { if (g) run.push(g); else { if (run.length > 1) pieces.push({ geometry: run }); run = []; } }
    if (run.length > 1) pieces.push({ geometry: run });
    return pieces;
  });
const lines = (await overpass(`(way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary)$"](${bbox});way["railway"="rail"]["usage"="main"](${bbox});way["waterway"="river"](${bbox}););out geom;`)).filter((x) => x.geometry?.length);

// Water: big lakes only (shore longer than 30 km on the map). An open shore is closed along the
// frame's edge on its water side, the side away from the frame's middle. The fill has no stroke; the
// shore is its own line, so the frame's cut edges never show as coast.
function waterOf(rels: Rel[], f: Frame, tol: number) {
  const water: Pt[][] = [], shore: Pt[][] = [], named: { name: string; ring: Pt[] }[] = [];
  for (const rel of rels) {
    const name = rel.tags?.name ?? "";
    const keep = (ring: Pt[], line: Pt[]) => { water.push(ring); shore.push(line); if (name) named.push({ name, ring }); };
    for (const c of stitch(lakeWays("outer", [rel]))) {
      const len = lengthOf(c.pts);
      if (c.closed) { if (len > 300 && c.pts.some((p) => near(p, f))) { const r = ringSimplify(c.pts, tol); keep(r, r); } continue; }
      for (const run of runsOnMap(c.pts, f)) {
        if (lengthOf(run) < 300) continue;
        const line = simplify(run, tol);
        // Walk the frame corners from the run's end back to its start, keeping the ones on the water side.
        const corners: Pt[] = [[f.x1 + MARGIN, f.y1 + MARGIN], [f.x0 - MARGIN, f.y1 + MARGIN], [f.x0 - MARGIN, f.y0 - MARGIN], [f.x1 + MARGIN, f.y0 - MARGIN]];
        const mid: Pt = [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2];
        const [ax, ay] = line[0]!, [bx, by] = line.at(-1)!;
        const side = (p: Pt) => Math.sign((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax));
        const landSide = side(mid);
        keep([...line, ...corners.filter((c) => side(c) !== landSide).sort((p, q) => Math.atan2(p[1] - mid[1], p[0] - mid[0]) - Math.atan2(q[1] - mid[1], q[0] - mid[0]))], line);
      }
    }
  }
  return { water, shore, named };
}
const islands: Pt[][] = [];
for (const c of stitch(lakeWays("inner"))) if (c.closed && lengthOf(c.pts) > 5 && c.pts.some((p) => near(p))) islands.push(ringSimplify(c.pts, 0.3));
const { water, shore, named } = waterOf(lakeRels, INNER, 0.3);

// The wide, low-detail ring around the box (--outer w,s,e,n): just the great lakes, their shores and
// the highways, simplified hard, so panning or zooming out never runs off the map.
const outerArg = arg("outer")?.split(",").map(Number);
let outer: { frame: Frame; water: Pt[][]; shore: Pt[][]; highway: Pt[][]; named: { name: string; ring: Pt[] }[] } | null = null;
if (outerArg?.length === 4) {
  const [ow, os, oe, on] = outerArg as [number, number, number, number];
  const [x0, y0] = pt(on, ow), [x1, y1] = pt(os, oe);
  const frame: Frame = { x0, y0, x1, y1 };
  const ob = `${os},${ow},${on},${oe}`;
  console.log("fetching the outer ring…");
  const rels = await overpass(`rel["natural"="water"]["name"~"^(Lake Ontario|Lake Erie|Lake Simcoe|Lake Huron|Georgian Bay|Lake Scugog)$"](${ob});out geom(${ob});`);
  const roads = (await overpass(`way["highway"="motorway"](${ob});out geom;`)).filter((x) => x.geometry?.length);
  const ring = waterOf(rels, frame, 3);
  const highway = stitch(roads).flatMap((c) => runsOnMap(c.pts, frame)).map((l) => simplify(l, 3)).filter((l) => lengthOf(l) > 20);
  outer = { frame, ...ring, highway };
}

// Where a lake's name can go: points on a 12 km grid inside its water and the box, nearest the
// middle first. The page shows the name at the first one in view that is clear of everything else.
const insideRing = ([x, y]: Pt, ring: Pt[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const labelFrame = outer?.frame ?? INNER;
// The outer ring's copy of a lake is the bigger one, so its name can travel further.
const allNamed = [...(outer?.named ?? []), ...named.filter((n2) => !outer?.named.some((o) => o.name === n2.name))];
const waterLabels = allNamed.map(({ name, ring }) => {
  const spots: Pt[] = [];
  for (let x = labelFrame.x0 + 60; x < labelFrame.x1 - 60; x += 120) for (let y = labelFrame.y0 + 40; y < labelFrame.y1 - 40; y += 120) {
    const q: Pt = [x, y];
    if (insideRing(q, ring) && !islands.some((isle) => insideRing(q, isle))) spots.push(q);
  }
  const cx = spots.reduce((a, p) => a + p[0], 0) / (spots.length || 1), cy = spots.reduce((a, p) => a + p[1], 0) / (spots.length || 1);
  spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  return { name, spots: spots.slice(0, 60).map(([x, y]) => [Math.round(x), Math.round(y)] as Pt) };
}).filter((l) => l.spots.length > 0)
  // One label per name: a lake split into several rings keeps the ring with the most room.
  .sort((a, b) => b.spots.length - a.spots.length).filter((l, i, all) => all.findIndex((o) => o.name === l.name) === i);

const by = (pred: (t: Record<string, string>) => boolean, tol: number, min: number) =>
  lines.filter((x) => pred(x.tags ?? {})).flatMap((x) => runsOnMap(x.geometry.map((g) => pt(g.lat, g.lon)))).map((l) => simplify(l, tol)).filter((l) => lengthOf(l) >= min);
// Roads that must meet: join pieces at shared ends first (ramps included), then simplify. Douglas-
// Peucker keeps every end, so junctions stay joined; nothing is dropped for being short.
const joined = (pred: (t: Record<string, string>) => boolean, tol: number) =>
  stitch(lines.filter((x) => pred(x.tags ?? {}))).flatMap((c) => runsOnMap(c.pts)).map((l) => simplify(l, tol));
const highway = joined((t) => t.highway === "motorway" || t.highway === "motorway_link", 0.5);
const trunk = joined((t) => t.highway === "trunk" || t.highway === "trunk_link", 0.5);
const primary = by((t) => t.highway === "primary", 0.8, 8);
const rail = by((t) => t.railway === "rail", 0.8, 6);
const rivers = by((t) => t.waterway === "river", 0.8, 6);

const shields: (XY & { ref: string })[] = [];
const byRef = new Map<string, Pt[][]>();
for (const x of lines) {
  const t = x.tags ?? {};
  if (t.highway !== "motorway" || !t.ref) continue;
  const ref = t.ref.split(";")[0]!.trim();
  byRef.set(ref, [...(byRef.get(ref) ?? []), x.geometry.map((g) => pt(g.lat, g.lon))]);
}
for (const [ref, ways] of byRef) {
  let carried = 150;
  for (const way of ways) for (let i = 1; i < way.length; i++) {
    const [ax, ay] = way[i - 1]!, [bx, by2] = way[i]!;
    carried += Math.hypot(bx - ax, by2 - ay);
    if (carried >= 300 && bx > 0 && by2 > 0 && bx < P.width && by2 < P.height) {
      if (!shields.some((q) => q.ref === ref && Math.hypot(q.x - bx, q.y - by2) < 200)) shields.push({ ref, x: f1(bx), y: f1(by2) });
      carried = 0;
    }
  }
}

const districts: { id: string; d: string }[] = [];
const file = arg("districts");
if (file) {
  const key = arg("district-key") ?? "id";
  const match = new RegExp(arg("district-match") ?? ".");
  const gj = JSON.parse(readFileSync(file, "utf8")) as { features: { properties: Record<string, string>; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  for (const f of gj.features) {
    const id = String(f.properties[key] ?? "");
    if (!match.test(id)) continue;
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    const rings = polys.flatMap((poly) => poly.map((ring) => ringSimplify(ring.map(([lng, lat]) => pt(lat!, lng!)), 0.4))).filter((r) => r.length > 3 && r.some((p) => near(p)));
    if (rings.length) districts.push({ id, d: pathOf(rings, true) });
  }
  districts.sort((a, b) => a.id.localeCompare(b.id));
}

const W = f1(P.width), H = f1(P.height);
const nss = 'vector-effect="non-scaling-stroke"';
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`,
  ...(outer ? [
    `<path id="outer-water" d="${pathOf(outer.water, true)}"/>`,
    `<path id="outer-shore" ${nss} d="${pathOf(outer.shore)}"/>`,
    `<path id="outer-highway" ${nss} d="${pathOf(outer.highway)}"/>`,
  ] : []),
  `<path id="water" d="${pathOf(water, true)}"/>`,
  `<path id="shore" ${nss} d="${pathOf(shore)}"/>`,
  `<path id="islands" d="${pathOf(islands, true)}"/>`,
  `<path id="rivers" ${nss} d="${pathOf(rivers)}"/>`,
  `<path id="rail" ${nss} d="${pathOf(rail)}"/>`,
  `<path id="primary" ${nss} d="${pathOf(primary)}"/>`,
  `<path id="trunk" ${nss} d="${pathOf(trunk)}"/>`,
  `<path id="highway" ${nss} d="${pathOf(highway)}"/>`,
  // One copy: the page outlines them all with #districts and fills one with #d-<id>.
  `<g id="districts">${districts.map((d) => `<path id="d-${d.id}" ${nss} d="${d.d}"/>`).join("")}</g>`,
  `</svg>`,
].join("\n");
const meta = {
  box, width: W, height: H, shields, waterLabels,
  ...(outer ? { outer: { x: Math.round(outer.frame.x0), y: Math.round(outer.frame.y0), w: Math.round(outer.frame.x1 - outer.frame.x0), h: Math.round(outer.frame.y1 - outer.frame.y0) } } : {}),
  districts: districts.map((d) => d.id),
};

mkdirSync(dirname(out!), { recursive: true });
writeFileSync(`${out}.svg`, svg);
writeFileSync(`${out}.json`, JSON.stringify(meta));
console.log(`wrote ${out}.svg (${Math.round(svg.length / 1024)} KB) and ${out}.json: ${water.length} water, ${islands.length} islands, ${highway.length} highway runs, ${shields.length} shields, ${districts.length} districts`);
