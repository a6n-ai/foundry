/**
 * A delivery zone is EITHER a postal zone (`postalPrefixes` non-empty, `radiusKm` null)
 * OR a circle measured from the store (`radiusKm` set, no prefixes). The DB enforces
 * that with a CHECK; numerics arrive as strings there and are converted on read.
 */
export type Zone = {
  /** DB row id when read from a query — apps stamp it on orders. Absent on test fixtures. */
  id?: bigint;
  publicId?: string;
  name: string;
  radiusKm: number | null;
  postalPrefixes: string[];
  slotWindow: string | null;
  active: boolean;
};

/** A fulfillment option and its rules. Rules live on the type, geography on the zone. */
export type DeliveryType = {
  id?: bigint;
  publicId?: string;
  key: string;
  label: string;
  description?: string | null;
  /** false = pickup: no address, no zone. */
  requiresAddress: boolean;
  requiresSchedule: boolean;
  minSubtotal: number;
  discountPct: number;
  sortOrder: number;
  active: boolean;
};

/** `types` = the zone's mapped types. Empty means the zone offers every active type. */
export type ZoneWithTypes = Zone & { types: DeliveryType[] };

/** Where the customer is. Postal is checked first; distance only matters when no postal zone matches. */
export type DeliveryLocation = { postalCode?: string | null; distanceKm?: number | null };

export const isPostalZone = (z: Zone): boolean => z.radiusKm == null;

/** Canadian FSA-style prefix: whitespace stripped, upper-cased. */
export function normalizePostal(postalCode: string): string {
  return postalCode.replace(/\s+/g, "").toUpperCase();
}

/** Active postal zone whose longest prefix matches the code, or null. */
export function matchPostalZone<Z extends Zone>(postalCode: string | null | undefined, zones: Z[]): Z | null {
  const code = postalCode ? normalizePostal(postalCode) : "";
  if (!code) return null;
  let best: { zone: Z; len: number } | null = null;
  for (const zone of zones) {
    if (!zone.active || !isPostalZone(zone)) continue;
    for (const prefix of zone.postalPrefixes) {
      const p = normalizePostal(prefix);
      if (p && code.startsWith(p) && (!best || p.length > best.len)) best = { zone, len: p.length };
    }
  }
  return best?.zone ?? null;
}

/** True when any active circle exists — the app only needs to geocode the address then. */
export function hasCircleZones(zones: Zone[]): boolean {
  return zones.some((z) => z.active && !isPostalZone(z));
}

/** The furthest circle we deliver to — shown to customers we turn away. Null when no circle is active. */
export function deliveryLimitKm(zones: Zone[]): number | null {
  const radii = zones.filter((z) => z.active && !isPostalZone(z)).map((z) => z.radiusKm as number);
  return radii.length ? Math.max(...radii) : null;
}

/**
 * Zones serving this location, most specific first: the matching postal zone alone, else
 * every active circle covering the distance (smallest first). Empty = not served.
 */
export function coveringZones<Z extends Zone>(location: DeliveryLocation, zones: Z[]): Z[] {
  const postal = matchPostalZone(location.postalCode, zones);
  if (postal) return [postal];
  const d = location.distanceKm;
  if (d == null) return [];
  return zones
    .filter((z) => z.active && !isPostalZone(z) && d <= (z.radiusKm as number))
    .sort((a, b) => (a.radiusKm as number) - (b.radiusKm as number));
}

/** Active types a zone offers: its mapped ones, or every active type when none are mapped. */
export function offeredTypes(zone: ZoneWithTypes, allTypes: DeliveryType[]): DeliveryType[] {
  return (zone.types.length ? zone.types : allTypes).filter((t) => t.active);
}

const byKeySorted = (types: Iterable<DeliveryType>): DeliveryType[] => {
  const byKey = new Map<string, DeliveryType>();
  for (const t of types) if (!byKey.has(t.key)) byKey.set(t.key, t);
  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
};

/** Address-requiring types offered at this location, deduplicated by key, ordered by sortOrder. */
export function availableTypes(location: DeliveryLocation, zones: ZoneWithTypes[], allTypes: DeliveryType[]): DeliveryType[] {
  return byKeySorted(
    coveringZones(location, zones).flatMap((z) => offeredTypes(z, allTypes)).filter((t) => t.requiresAddress),
  );
}

/**
 * Types offered somewhere but not here — e.g. Instant only in the 7km circle, address is 9km
 * out. Lets the UI say *why* a type vanished instead of just not showing it.
 */
export function unavailableTypes(location: DeliveryLocation, zones: ZoneWithTypes[], allTypes: DeliveryType[]): DeliveryType[] {
  const here = new Set(availableTypes(location, zones, allTypes).map((t) => t.key));
  return byKeySorted(
    zones
      .filter((z) => z.active)
      .flatMap((z) => offeredTypes(z, allTypes))
      .filter((t) => t.requiresAddress && !here.has(t.key)),
  );
}

/** Most specific covering zone that offers the type. */
export function zoneForType(
  location: DeliveryLocation,
  typeKey: string,
  zones: ZoneWithTypes[],
  allTypes: DeliveryType[],
): ZoneWithTypes | null {
  return coveringZones(location, zones).find((z) => offeredTypes(z, allTypes).some((t) => t.key === typeKey)) ?? null;
}

export type DeliveryChoice =
  | { ok: true; type: DeliveryType | null; zone: Zone }
  | { ok: false; reason: "out-of-range" | "not-offered" | "below-minimum" | "needs-schedule"; message: string };

/**
 * Eligibility for a delivery checkout. `typeKey` null = the app has no types configured,
 * so any covering zone serves plain delivery. Pure so the exploit it closes — a type valid
 * close to the store being accepted further out — is testable without a database.
 */
export function chooseDelivery(input: {
  location: DeliveryLocation;
  typeKey: string | null;
  zones: ZoneWithTypes[];
  allTypes: DeliveryType[];
  subtotal: number;
  scheduledFor?: string;
}): DeliveryChoice {
  const { location, typeKey, zones, allTypes, subtotal, scheduledFor } = input;
  const covering = coveringZones(location, zones);

  if (typeKey == null) {
    const zone = covering[0];
    return zone
      ? { ok: true, type: null, zone }
      : { ok: false, reason: "out-of-range", message: "We don't deliver to that address yet." };
  }

  const offered = availableTypes(location, zones, allTypes);
  const type = offered.find((t) => t.key === typeKey);
  if (!type) {
    const limit = deliveryLimitKm(zones);
    const d = location.distanceKm;
    return {
      ok: false,
      reason: "not-offered",
      message:
        covering.length === 0
          ? limit != null && d != null
            ? `We don't deliver that far yet (${d} km — we deliver up to ${limit} km).`
            : "We don't deliver to that address yet."
          : "That delivery option isn't available for this address.",
    };
  }
  if (subtotal < type.minSubtotal) {
    return { ok: false, reason: "below-minimum", message: `${type.label} requires an order over $${type.minSubtotal}.` };
  }
  if (type.requiresSchedule && !scheduledFor) {
    return { ok: false, reason: "needs-schedule", message: `Pick a delivery time for ${type.label}.` };
  }
  const zone = zoneForType(location, type.key, zones, allTypes);
  if (!zone) return { ok: false, reason: "out-of-range", message: "Could not resolve a delivery zone for that address." };
  return { ok: true, type, zone };
}

const money = (n: number): number => Math.round(n * 100) / 100;

/** A type's money effect: its discount on the subtotal. */
export function applyTypeDiscount(input: { subtotal: number; type: Pick<DeliveryType, "discountPct"> }): { discountAmount: number } {
  return { discountAmount: money(input.subtotal * (input.type.discountPct / 100)) };
}

/** Minimum gap kept between circle radii so rings never share or cross a boundary. */
export const RING_GAP_KM = 0.01;

/**
 * Clamp a circle's radius between its neighbouring active circles so a save or map drag
 * can never reorder or overlap rings. Postal zones are ignored.
 */
export function clampRadiusKm(radiusKm: number, zones: Zone[], excludePublicId: string | null): number {
  const others = zones
    .filter((z) => z.active && !isPostalZone(z) && z.publicId !== excludePublicId)
    .map((z) => z.radiusKm as number);
  const smaller = others.filter((r) => r < radiusKm);
  const larger = others.filter((r) => r > radiusKm);
  const lower = smaller.length ? Math.max(...smaller) + RING_GAP_KM : RING_GAP_KM;
  const upper = larger.length ? Math.min(...larger) - RING_GAP_KM : Infinity;
  return Math.min(Math.max(radiusKm, lower), Math.max(lower, upper));
}
