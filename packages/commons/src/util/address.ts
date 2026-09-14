import { z } from "zod";

/** Radix Select forbids an empty-string item value — map back to "" in onValueChange. */
export const NO_PROVINCE = "__none__";

export const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
] as const;

export type AddressFieldKey =
  | "fullName"
  | "addressLine"
  | "addressUnit"
  | "city"
  | "postalCode"
  | "province"
  | "deliveryInstructions";

export type AddressValues = Partial<Record<AddressFieldKey, string>>;

export const ADDRESS_FIELD_PRESETS = {
  profile: ["addressLine", "addressUnit", "city", "postalCode", "province"] as const,
  // addressUnit is always visible, never behind a toggle — Google's
  // formatted address/autocomplete has no reliable subpremise/unit field,
  // so a hidden control is a missed-unit delivery waiting to happen.
  // deliveryInstructions is one free-text note (gate code, leave at door,
  // etc.), matching Amazon's pattern of a single instructions field rather
  // than a separate structured buzzer-code field.
  delivery: ["fullName", "addressLine", "addressUnit", "city", "postalCode", "deliveryInstructions"] as const,
} as const;

export type AddressFieldPreset = keyof typeof ADDRESS_FIELD_PRESETS;

export const ADDRESS_FIELD_LABELS: Record<AddressFieldKey, string> = {
  fullName: "Full name",
  addressLine: "Street address",
  addressUnit: "Unit / Apt",
  city: "City",
  postalCode: "Postal code",
  province: "Province",
  deliveryInstructions: "Delivery instructions (optional)",
};

export const ADDRESS_FIELD_PLACEHOLDERS: Partial<Record<AddressFieldKey, string>> = {
  fullName: "Jane Doe",
  addressLine: "123 Maple St",
  addressUnit: "Apt 4B",
  city: "Toronto",
  postalCode: "M5V 2T6",
  deliveryInstructions: "Gate code, leave at door, call on arrival…",
};

export const ADDRESS_FIELD_AUTOCOMPLETE: Partial<Record<AddressFieldKey, string>> = {
  fullName: "name",
  addressLine: "address-line1",
  addressUnit: "address-line2",
  city: "address-level2",
  postalCode: "postal-code",
};

/** Uppercase Canadian postal code with a single space after the FSA (e.g. M5V 2T6). */
export function normalizePostalCode(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`.trim();
}

export const profileAddressSchema = z.object({
  addressLine: z.string().max(200, "Address is too long"),
  addressUnit: z.string().max(40, "Unit is too long"),
  city: z.string().max(100, "City is too long"),
  postalCode: z.string().max(12, "Postal code is too long"),
  province: z.string().max(2),
});

export const deliveryAddressSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120, "Name is too long"),
  addressLine: z.string().trim().min(1, "Address is required").max(200, "Address is too long"),
  addressUnit: z.string().trim().max(60, "Unit is too long").optional(),
  city: z.string().trim().min(1, "City is required").max(100, "City is too long"),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20, "Postal code is too long"),
  deliveryInstructions: z.string().trim().max(500, "Instructions are too long").optional(),
});

export type ProfileAddressValues = z.infer<typeof profileAddressSchema>;
export type DeliveryAddressValues = z.infer<typeof deliveryAddressSchema>;

// A franchise/organization's own place (its `organization.city/address/latitude/
// longitude` columns) — distinct from a customer's delivery AddressValues above.
// Reuse this shape anywhere a franchise location is read or written: the admin
// client-detail form, the public location picker/map, IP-geo matching.
export type OrgLocation = {
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};
