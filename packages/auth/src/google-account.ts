import { APIError } from "better-auth/api";
import { revokeUnprovenAccountAccess } from "better-auth/db";

type RevokeCtx = Parameters<typeof revokeUnprovenAccountAccess>[0];
type AccountRow = Record<string, unknown> & { providerId?: unknown; userId?: unknown; idToken?: unknown };

/** The OAuth callback is one route, "/callback/:id"; name the provider ("/callback/google") so sign-in checks can match it. */
export function signInPath(path: string, params?: unknown): string {
  return path === "/callback/:id" ? `/callback/${(params as { id?: string } | undefined)?.id}` : path;
}

/** Audit label per sign-in route; "email" (password) keeps its historic label. */
export const SIGN_IN_METHOD: Record<string, string> = {
  "/sign-in/email": "email",
  "/sign-in/email-otp": "email_code",
  "/magic-link/verify": "invite_link",
  "/callback/google": "google",
  "/one-tap/callback": "google",
};

/**
 * The `picture` claim of the ID token Better Auth just received and verified
 * from Google on this callback; reading it needs no second verification.
 */
export function googlePicture(idToken: string): string | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { picture?: unknown };
  return typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : null;
}

const NO_TOKENS = { accessToken: null, refreshToken: null, idToken: null };

/**
 * `databaseHooks.account` for apps that link Google onto existing accounts
 * with `accountLinking.requireLocalEmailVerified: false` (checkout, invite and
 * signup accounts are often unverified).
 *
 * - Linking verifies the address, so first run Better Auth's own guard for
 *   unverified→verified paths: drop any password and session nobody proved
 *   they own. Otherwise a stranger could pre-register a victim's address with
 *   their own password and the victim's Google sign-in would verify it.
 *   Without a request context the guard cannot run: refuse unverified accounts.
 * - Google's tokens are never stored (nothing calls a Google API); the photo is
 *   read from the ID token first and set only when the account has none.
 */
export function googleAccountHooks(deps: {
  isEmailVerified: (userId: bigint) => Promise<boolean>;
  setImageIfEmpty: (userId: bigint, url: string) => Promise<void>;
  onError?: (err: unknown, message: string) => void;
}) {
  return {
    create: {
      before: async (acc: AccountRow, ctx: RevokeCtx | null | undefined) => {
        if (acc.providerId !== "google") return;
        const userId = BigInt(acc.userId as string);
        if (ctx) await revokeUnprovenAccountAccess(ctx, String(acc.userId));
        else if (!(await deps.isEmailVerified(userId))) {
          throw new APIError("FORBIDDEN", { message: "Verify your email before connecting Google." });
        }
        if (typeof acc.idToken === "string") {
          try {
            const picture = googlePicture(acc.idToken);
            if (picture) await deps.setImageIfEmpty(userId, picture);
          } catch (e) {
            deps.onError?.(e, "google photo copy failed");
          }
        }
        return { data: { ...acc, ...NO_TOKENS } };
      },
    },
    update: {
      // Each Google sign-in refreshes the tokens on the linked row; drop them again.
      before: async (acc: Record<string, unknown>) => {
        if (!("accessToken" in acc || "refreshToken" in acc || "idToken" in acc)) return;
        return { data: { ...acc, ...NO_TOKENS } };
      },
    },
  };
}
