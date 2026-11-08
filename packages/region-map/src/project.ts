/** A region's box in degrees. */
export type RegionBox = { w: number; s: number; e: number; n: number };
export type XY = { x: number; y: number };
export type LatLng = { lat: number; lng: number };

/** Map units per kilometre. The drawn region file and every mark share this scale. */
export const UNITS_PER_KM = 10;

/** Equirectangular at the box's middle latitude: true enough across a metro area, and the same
 *  maths in the build script and the browser, so marks land on the drawn map exactly. */
export function projector(box: RegionBox) {
  const lat0 = (box.s + box.n) / 2;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180) * UNITS_PER_KM;
  const ky = 110.57 * UNITS_PER_KM;
  return {
    width: (box.e - box.w) * kx,
    height: (box.n - box.s) * ky,
    at: ({ lat, lng }: LatLng): XY => ({ x: (lng - box.w) * kx, y: (box.n - lat) * ky }),
    back: ({ x, y }: XY): LatLng => ({ lat: box.n - y / ky, lng: box.w + x / kx }),
  };
}
