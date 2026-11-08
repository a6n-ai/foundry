import { describe, expect, it } from "vitest";
import { frameOf } from "../frame";
import { CHIP, placeLabels } from "../labels";
import { projector } from "../project";

const box = { w: -80.1, s: 43.35, e: -78.7, n: 44.1 };

describe("projector", () => {
  it("round-trips a point and puts north-west at the origin", () => {
    const P = projector(box);
    expect(P.at({ lat: box.n, lng: box.w })).toEqual({ x: 0, y: 0 });
    const back = P.back(P.at({ lat: 43.65, lng: -79.38 }));
    expect(back.lat).toBeCloseTo(43.65, 9);
    expect(back.lng).toBeCloseTo(-79.38, 9);
  });
  it("is 10 units per km", () => {
    const P = projector(box);
    expect(P.at({ lat: box.n - 1 / 110.57, lng: box.w }).y).toBeCloseTo(10, 6);
  });
});

describe("frameOf", () => {
  const pad = { top: 36, right: 36, bottom: 36, left: 36 };
  it("puts every point inside the padded box", () => {
    const pts = [{ x: 100, y: 200 }, { x: 600, y: 250 }, { x: 350, y: 500 }];
    const v = frameOf(pts, 390, 300, pad);
    for (const p of pts) {
      const x = (p.x - v.x) * v.scale, y = (p.y - v.y) * v.scale;
      expect(x).toBeGreaterThanOrEqual(35.9); expect(x).toBeLessThanOrEqual(390 - 35.9);
      expect(y).toBeGreaterThanOrEqual(35.9); expect(y).toBeLessThanOrEqual(300 - 35.9);
    }
  });
  it("keeps the box's aspect and caps the zoom on one point", () => {
    const v = frameOf([{ x: 500, y: 500 }], 400, 200, pad, { maxScale: 2 });
    expect(v.scale).toBe(2);
    expect(v.w / v.h).toBeCloseTo(2, 6);
  });
  it("leaves the left side clear for a panel", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1000, y: 600 }];
    const v = frameOf(pts, 1200, 560, { top: 56, right: 56, bottom: 56, left: 440 });
    for (const p of pts) expect((p.x - v.x) * v.scale).toBeGreaterThanOrEqual(439.9);
  });
});

describe("placeLabels", () => {
  it("puts every name above its dot when nothing collides", () => {
    expect(placeLabels([{ name: "Brampton", x: 100, y: 100 }, { name: "Markham", x: 400, y: 100 }])).toEqual(["top", "top"]);
  });
  it("drops a crowded name below its dot", () => {
    expect(placeLabels([{ name: "Toronto", x: 200, y: 200 }, { name: "East York", x: 220, y: 196 }])).toEqual(["bottom", "top"]);
  });
  it("moves a name beside its dot when above and below are taken", () => {
    const tight = [{ name: "Markham", x: 200, y: 100 }, { name: "Vaughan", x: 200, y: 130 }, { name: "North York", x: 200, y: 160 }, { name: "Etobicoke", x: 200, y: 185 }];
    expect(placeLabels(tight)).toEqual(["top", "right", "right", "bottom"]);
  });
  it("keeps a name inside the map", () => {
    expect(placeLabels([{ name: "Scarborough", x: 340, y: 100 }], CHIP.compact, { w: 358, h: 300 })).toEqual(["left"]);
  });
  it("hides a name with no room on any side", () => {
    const boxed = [{ name: "Centre", x: 200, y: 200 }, { name: "N", x: 200, y: 172 }, { name: "S", x: 200, y: 228 }, { name: "E", x: 228, y: 200 }, { name: "W", x: 172, y: 200 }];
    expect(placeLabels(boxed)[0]).toBe("none");
  });
});

import { clampView, zoomAt } from "../frame";

describe("zoomAt", () => {
  const base = { x: 0, y: 0, w: 400, h: 300, scale: 1 };
  it("keeps the point under the pointer still", () => {
    const v = zoomAt(base, 2, 100, 50, { min: 0.25, max: 8 });
    expect((100 - v.x) * v.scale).toBeCloseTo(100, 9);
    expect((50 - v.y) * v.scale).toBeCloseTo(50, 9);
    expect(v.w).toBe(200);
  });
  it("holds the scale between min and max", () => {
    expect(zoomAt(base, 0.01, 0, 0, { min: 0.25, max: 8 }).scale).toBe(0.25);
    expect(zoomAt(base, 100, 0, 0, { min: 0.25, max: 8 }).scale).toBe(8);
  });
  it("never lets a drag take the map off screen", () => {
    const v = clampView({ x: 5000, y: -5000, w: 400, h: 300, scale: 1 }, { w: 1000, h: 800 });
    expect(v.x).toBe(800);
    expect(v.y).toBe(-150);
  });
});
