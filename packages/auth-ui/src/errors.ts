/** The shape Better Auth client calls resolve `error` to. */
export type AuthClientError = { code?: string; status?: number; message?: string } | null | undefined;

/**
 * One wording for every auth failure, so each screen says what went wrong and
 * what to do next instead of a bare "something went wrong". Never says whether
 * an account exists.
 */
export function authErrorMessage(err: AuthClientError | unknown, during: "send" | "verify" | "password"): string {
  const e = (err ?? {}) as { code?: string; status?: number };
  if (e.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (e.code === "OTP_EXPIRED") return "That code has expired. Send a new one and use the latest email.";
  if (e.code === "TOO_MANY_ATTEMPTS") return "Too many wrong codes. Send a new code to try again.";
  if (e.code === "INVALID_OTP") return "That code doesn't match. Check the latest email and try again.";
  if (!e.status && !e.code) return "Can't connect right now. Check your connection and try again.";
  if (during === "verify") return "That code doesn't match. Check the latest email and try again.";
  if (during === "password") return "That email and password don't match. Try again or reset your password.";
  return "Something went wrong on our side. Try again in a moment.";
}

/** Thrown-or-returned helper: null when the call succeeded. */
export function errorOf(res: unknown): AuthClientError {
  return (res as { error?: AuthClientError } | null | undefined)?.error ?? null;
}
