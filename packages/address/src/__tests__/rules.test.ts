import { describe, expect, it } from "vitest";
import { defaultLabel, locationChanged, normalizeAddressInput } from "../rules";

const base = { addressLine: " 12 Maple St ", city: " Toronto ", postalCode: "m5v2t6" };

describe("normalizeAddressInput", () => {
  it("trims, formats the postal code, and nulls empties", () => {
    expect(normalizeAddressInput({ ...base, addressUnit: "  ", label: " Home " })).toMatchObject({
      addressLine: "12 Maple St", city: "Toronto", postalCode: "M5V 2T6", addressUnit: null, label: "Home",
    });
  });
  it("rejects missing street, city or postal code", () => {
    expect(() => normalizeAddressInput({ ...base, addressLine: " " })).toThrow("Address is required");
    expect(() => normalizeAddressInput({ ...base, city: "" })).toThrow("City is required");
    expect(() => normalizeAddressInput({ ...base, postalCode: "" })).toThrow("Postal code is required");
  });
});

describe("defaultLabel", () => {
  it("first address is Home", () => expect(defaultLabel({ addressLine: "12 Maple St" }, [], true)).toBe("Home"));
  it("later ones use the street line", () =>
    expect(defaultLabel({ addressLine: "12 Maple St" }, ["Home"], false)).toBe("12 Maple St"));
  it("suffixes on collision, case-insensitive", () =>
    expect(defaultLabel({ addressLine: "12 Maple St" }, ["Home", "12 maple st", "12 Maple St (2)"], false)).toBe("12 Maple St (3)"));
  it("first address still avoids an existing Home", () =>
    expect(defaultLabel({ addressLine: "1 A St" }, ["home"], true)).toBe("Home (2)"));
});

describe("locationChanged", () => {
  const a = { fullName: "A", addressLine: "1 A St", addressUnit: null, city: "T", postalCode: "M5V 2T6", deliveryInstructions: null };
  it("ignores unit, name and instructions", () =>
    expect(locationChanged(a, { ...a, addressUnit: "4B", fullName: "B", deliveryInstructions: "gate" })).toBe(false));
  it("detects street, city or postal change", () => {
    expect(locationChanged(a, { ...a, addressLine: "2 A St" })).toBe(true);
    expect(locationChanged(a, { ...a, postalCode: "M5V 2T7" })).toBe(true);
  });
});
