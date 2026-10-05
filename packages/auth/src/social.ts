/**
 * Google sign-in for Better Auth's `socialProviders`. Spread the result in:
 * `socialProviders: { ...googleSocialProviders() }`.
 *
 * Sign-in only: Realm accounts are provisioned by checkout or an admin invite,
 * so a Google address with no account is refused (`signup_disabled`) rather
 * than creating a bare user. An existing account with the same email links on
 * first use — Google marks its emails verified, which is Better Auth's default
 * linking condition.
 *
 * Returns `{}` until both keys are set, so an app without them mounts no
 * Google route at all.
 */
export function googleSocialProviders(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return {
    google: { clientId, clientSecret, disableSignUp: true, prompt: "select_account" as const },
  };
}

/** For the client: show the Google button only when the server mounted the provider. */
export function googleSignInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
