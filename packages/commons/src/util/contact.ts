import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));

export function phoneSchema(defaultCountry: CountryCode = "CA"): z.ZodType<string> {
  return z
    .string()
    .trim()
    .refine((v) => isValidPhoneNumber(v, defaultCountry), "Enter a valid phone number")
    .transform((v, ctx) => {
      const parsed = parsePhoneNumber(v, defaultCountry);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return parsed.format("E.164");
    });
}

// Display formatter for a phone stored as E.164 (phoneSchema()'s transform output) —
// renders with its own country code (e.g. +16475334193 -> "+1 647 533 4193",
// +919876543210 -> "+91 98765 43210"), never a fixed locale, since the country digit
// is already encoded in the E.164 string itself. Falls back to the raw value for
// anything unparseable (legacy/malformed data) rather than throwing.
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

// Regional-indicator flag emoji for an E.164 phone's country (e.g. +16475334193 ->
// "🇨🇦"). Each letter of the ISO 3166-1 alpha-2 code maps to its regional-indicator
// codepoint (U+1F1E6 = 🇦, offset from 'A'); "" for anything unparseable so callers
// can safely do `${phoneCountryFlag(p)} ${formatPhone(p)}`.trim() without a stray space.
export function phoneCountryFlag(e164: string | null | undefined): string {
  const country = e164 ? parsePhoneNumberFromString(e164)?.country : undefined;
  if (!country) return "";
  return [...country].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function tzToDefaultCountry(timezone: string): CountryCode {
  if (timezone === "Asia/Kolkata") return "IN";
  return "CA";
}

/** The providers most customers use; shown as one-tap completions after "@". */
export const COMMON_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"] as const;

/**
 * Completions for what is typed after "@": nothing before the "@" is typed, or
 * once the domain already matches one exactly.
 */
export function emailDomainSuggestions(value: string): string[] {
  const at = value.indexOf("@");
  if (at < 1 || value.indexOf("@", at + 1) !== -1) return [];
  const local = value.slice(0, at);
  const partial = value.slice(at + 1).toLowerCase();
  return COMMON_EMAIL_DOMAINS.filter((d) => d.startsWith(partial) && d !== partial).map((d) => `${local}@${d}`);
}
