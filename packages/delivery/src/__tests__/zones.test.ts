import { describe, expect, it } from "vitest";
import {
  availableTypes,
  chooseDelivery,
  clampRadiusKm,
  coveringZones,
  deliveryLimitKm,
  matchPostalZone,
  unavailableTypes,
  zoneForType,
  type DeliveryType,
  type ZoneWithTypes,
} from "../zones";

const type = (key: string, sortOrder: number, extra: Partial<DeliveryType> = {}): DeliveryType => ({
  key, label: key, requiresAddress: true, requiresSchedule: false, minSubtotal: 0, discountPct: 0, sortOrder, active: true, ...extra,
});
const instant = type("instant", 1, { discountPct: 15 });
const scheduled = type("scheduled", 2, { requiresSchedule: true, minSubtotal: 35 });
const pickup = type("pickup", 0, { requiresAddress: false });
const allTypes = [pickup, instant, scheduled];

const circle = (name: string, radiusKm: number, types: DeliveryType[] = [], active = true): ZoneWithTypes => ({
  name, radiusKm, postalPrefixes: [], slotWindow: null, active, types, publicId: name,
});
const postal = (name: string, postalPrefixes: string[], types: DeliveryType[] = [], active = true): ZoneWithTypes => ({
  name, radiusKm: null, postalPrefixes, slotWindow: "9–12", active, types, publicId: name,
});

// puchkaman's seeded shape: Inner 7km offers instant+scheduled, Outer 20km scheduled only.
const inner = circle("Inner", 7, [instant, scheduled]);
const outer = circle("Outer", 20, [scheduled]);
const rings = [outer, inner]; // deliberately unsorted

describe("matchPostalZone", () => {
  const zones = [
    postal("Etobicoke", ["M8", "M9"]),
    postal("Markham", ["L3R"]),
    postal("L3", ["L3"]),
    postal("Inactive", ["X1"], [], false),
    circle("Ring", 50),
  ];
  it("normalises case and spacing", () => expect(matchPostalZone("m9v 1a1", zones)?.name).toBe("Etobicoke"));
  it("prefers the longest prefix", () => expect(matchPostalZone("L3R 9K1", zones)?.name).toBe("Markham"));
  it("ignores inactive and circle zones", () => {
    expect(matchPostalZone("X1Y 2Z3", zones)).toBeNull();
    expect(matchPostalZone("K1A 0B1", zones)).toBeNull();
  });
});

describe("coveringZones", () => {
  it("postal match wins over any circle", () => {
    const zones = [circle("Ring", 50), postal("Downtown", ["M5"])];
    expect(coveringZones({ postalCode: "M5V", distanceKm: 1 }, zones).map((z) => z.name)).toEqual(["Downtown"]);
  });
  it("falls back to circles, smallest first, boundary inclusive", () => {
    expect(coveringZones({ postalCode: "K1A", distanceKm: 7 }, rings).map((z) => z.name)).toEqual(["Inner", "Outer"]);
  });
  it("is empty with no postal hit and no distance", () => {
    expect(coveringZones({ postalCode: "K1A" }, rings)).toEqual([]);
  });
});

describe("availableTypes", () => {
  it("unions every covering zone's types", () => {
    expect(availableTypes({ distanceKm: 3 }, rings, allTypes).map((t) => t.key)).toEqual(["instant", "scheduled"]);
    expect(availableTypes({ distanceKm: 12 }, rings, allTypes).map((t) => t.key)).toEqual(["scheduled"]);
    expect(availableTypes({ distanceKm: 20.01 }, rings, allTypes)).toEqual([]);
  });
  it("a zone with no mapped types offers every active address type (never pickup)", () => {
    expect(availableTypes({ distanceKm: 3 }, [circle("Open", 10)], allTypes).map((t) => t.key)).toEqual(["instant", "scheduled"]);
  });
  it("skips inactive zones and types", () => {
    expect(availableTypes({ distanceKm: 3 }, [{ ...inner, active: false }, outer], allTypes).map((t) => t.key)).toEqual(["scheduled"]);
    const dead = [{ ...inner, types: [{ ...instant, active: false }, scheduled] }];
    expect(availableTypes({ distanceKm: 3 }, dead, allTypes).map((t) => t.key)).toEqual(["scheduled"]);
  });
  it("explains what is offered elsewhere", () => {
    expect(unavailableTypes({ distanceKm: 12 }, rings, allTypes).map((t) => t.key)).toEqual(["instant"]);
  });
});

describe("zoneForType", () => {
  it("smallest covering zone offering the type", () => {
    expect(zoneForType({ distanceKm: 3 }, "scheduled", rings, allTypes)?.name).toBe("Inner");
    expect(zoneForType({ distanceKm: 12 }, "scheduled", rings, allTypes)?.name).toBe("Outer");
    expect(zoneForType({ distanceKm: 12 }, "instant", rings, allTypes)).toBeNull();
  });
});

describe("chooseDelivery", () => {
  const base = { zones: rings, allTypes, subtotal: 100 };
  it("rejects a type valid only closer in — the exploit", () => {
    expect(chooseDelivery({ ...base, location: { distanceKm: 12 }, typeKey: "instant" }).ok).toBe(false);
  });
  it("accepts an offered type with the smallest offering zone", () => {
    expect(chooseDelivery({ ...base, location: { distanceKm: 3 }, typeKey: "instant" })).toMatchObject({
      ok: true, type: { key: "instant" }, zone: { name: "Inner" },
    });
  });
  it("enforces minSubtotal and schedule", () => {
    const low = chooseDelivery({ ...base, subtotal: 10, location: { distanceKm: 3 }, typeKey: "scheduled", scheduledFor: "x" });
    expect(!low.ok && low.message).toContain("$35");
    const unscheduled = chooseDelivery({ ...base, location: { distanceKm: 3 }, typeKey: "scheduled" });
    expect(!unscheduled.ok && unscheduled.reason).toBe("needs-schedule");
  });
  it("names the limit when beyond every circle", () => {
    const far = chooseDelivery({ ...base, location: { distanceKm: 99 }, typeKey: "scheduled" });
    expect(!far.ok && far.message).toContain("20 km");
  });
  it("with no types configured, any covering zone serves plain delivery (tiffin-grab)", () => {
    const zones = [postal("Etobicoke", ["M9"])];
    expect(chooseDelivery({ zones, allTypes: [], subtotal: 0, location: { postalCode: "M9V" }, typeKey: null })).toMatchObject({
      ok: true, type: null, zone: { name: "Etobicoke" },
    });
    expect(chooseDelivery({ zones, allTypes: [], subtotal: 0, location: { postalCode: "K1A" }, typeKey: null }).ok).toBe(false);
  });
});

describe("rings", () => {
  it("deliveryLimitKm ignores postal zones", () => {
    expect(deliveryLimitKm([...rings, postal("P", ["M9"])])).toBe(20);
    expect(deliveryLimitKm([postal("P", ["M9"])])).toBeNull();
  });
  it("clampRadiusKm keeps a ring between its neighbours", () => {
    expect(clampRadiusKm(19.995, rings, "Inner")).toBeCloseTo(19.99);
    expect(clampRadiusKm(7.001, rings, "Outer")).toBeCloseTo(7.01);
    expect(clampRadiusKm(0, rings, "Inner")).toBeCloseTo(0.01);
  });
});
