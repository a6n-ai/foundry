/**
 * "Welcome back, Vijay": remembers who last signed in on this device so the
 * sign-in screen can offer "Continue as …". A plain cookie, kept after
 * sign-out on purpose, cleared by "Not you?" or the next person's sign-in.
 * It holds only a first name, the email, a photo URL and how they signed in,
 * never a token, so reading it grants nothing.
 */
export const LAST_USER_COOKIE = "last_user";
export const LAST_USER_MAX_AGE_S = 180 * 24 * 60 * 60;

export type LastUserMethod = "google" | "email" | "password";
export interface LastUser {
  firstName: string;
  email: string;
  method: LastUserMethod;
  /** Avatar URL for the "Welcome back" card; https (Google) or a same-site path only. */
  image?: string;
}

/** Which sign-in a Better Auth path is, or null for paths that are not a sign-in. */
export function lastUserMethod(path: string): LastUserMethod | null {
  if (path === "/callback/google" || path === "/one-tap/callback") return "google";
  if (path === "/sign-in/email-otp" || path === "/magic-link/verify") return "email";
  if (path === "/sign-in/email") return "password";
  return null;
}

/** Cookie value for a fresh session, or null when the path is not a sign-in. */
export function encodeLastUser(path: string, user: { name?: string | null; email: string; image?: string | null }): string | null {
  const method = lastUserMethod(path);
  if (!method) return null;
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] ?? "";
  // URI-encoded: JSON's quotes and commas are not valid in a raw cookie value.
  const image = safeImage(user.image);
  return encodeURIComponent(JSON.stringify({ firstName, email: user.email, method, ...(image ? { image } : {}) } satisfies LastUser));
}

/** Tolerates a missing, tampered or old-shape cookie: anything odd reads as no one. */
export function parseLastUser(raw: string | undefined | null): LastUser | null {
  if (!raw) return null;
  try {
    // Some cookie readers decode for us, some do not.
    const v = JSON.parse(raw.startsWith("%7B") ? decodeURIComponent(raw) : raw) as Partial<LastUser>;
    if (typeof v.email !== "string" || !v.email.includes("@")) return null;
    if (v.method !== "google" && v.method !== "email" && v.method !== "password") return null;
    const image = safeImage(v.image);
    return {
      firstName: typeof v.firstName === "string" ? v.firstName.slice(0, 40) : "",
      email: v.email,
      method: v.method,
      ...(image ? { image } : {}),
    };
  } catch {
    return null;
  }
}

/** "vishwas@gmail.com" -> "vi•••@gmail.com", for showing on a possibly shared screen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}•••@${domain}`;
}

/** The cookie is page-writable, so its image only renders as an <img> if it is https or a same-site path. */
function safeImage(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 500) return null;
  return url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//")) ? url : null;
}

/** Cookie options for LAST_USER_COOKIE. Readable by the page (not httpOnly): it holds no token. */
export function lastUserCookieOptions(production = process.env.NODE_ENV === "production") {
  return { path: "/", maxAge: LAST_USER_MAX_AGE_S, sameSite: "lax" as const, httpOnly: false, secure: production };
}
