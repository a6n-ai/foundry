import { normalizePostalCode, ValidationError } from "@foundry/commons";

export type AddressInput = {
  label?: string | null;
  fullName?: string | null;
  addressLine: string;
  addressUnit?: string | null;
  city: string;
  province?: string | null;
  postalCode: string;
  deliveryInstructions?: string | null;
};

/** The fields copied onto an order/delivery. */
export type AddressSnapshot = {
  fullName: string | null;
  addressLine: string;
  addressUnit: string | null;
  city: string;
  postalCode: string;
  deliveryInstructions: string | null;
};

export type SavedAddress = AddressSnapshot & {
  publicId: string;
  label: string;
  province: string | null;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
};

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

const required = (v: string | null | undefined, message: string): string => {
  const t = clean(v);
  if (!t) throw new ValidationError(message);
  return t;
};

export function normalizeAddressInput(input: AddressInput) {
  return {
    label: clean(input.label),
    fullName: clean(input.fullName),
    addressLine: required(input.addressLine, "Address is required"),
    addressUnit: clean(input.addressUnit),
    city: required(input.city, "City is required"),
    province: clean(input.province),
    postalCode: normalizePostalCode(required(input.postalCode, "Postal code is required")),
    deliveryInstructions: clean(input.deliveryInstructions),
  };
}

/** "Home" for a first address, else the street line; " (n)" on a case-insensitive clash. */
export function defaultLabel(input: { addressLine: string }, existingLabels: string[], isFirst: boolean): string {
  const taken = new Set(existingLabels.map((l) => l.toLowerCase()));
  const stem = isFirst ? "Home" : input.addressLine.trim();
  if (!taken.has(stem.toLowerCase())) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Only these move the pin; unit/name/instructions never need a re-geocode or zone re-match. */
export function locationChanged(before: AddressSnapshot, after: AddressSnapshot): boolean {
  return (
    before.addressLine !== after.addressLine ||
    before.city !== after.city ||
    before.postalCode !== after.postalCode
  );
}

export function toSnapshot(row: AddressSnapshot): AddressSnapshot {
  return {
    fullName: row.fullName,
    addressLine: row.addressLine,
    addressUnit: row.addressUnit,
    city: row.city,
    postalCode: row.postalCode,
    deliveryInstructions: row.deliveryInstructions,
  };
}
