import { z } from "zod";

// Kept apart from contact.ts: an email-only form (sign-in) shouldn't pull libphonenumber's metadata.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));
