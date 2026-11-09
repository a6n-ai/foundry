import { z } from "zod";

// Apps feed these into better-auth `minPasswordLength`/`maxPasswordLength` too.
// Applies to new and changed passwords only; sign-in never
// checks length, so existing shorter passwords keep working.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, "Password is too long");
