/**
 * Google sign-in for Better Auth's `socialProviders`. Spread the result in:
 * `socialProviders: { ...googleSocialProviders() }`.
 *
 * Sign-in only by default: a Google address with no account is refused
 * (`?error=signup_disabled`). `allowSignUp` is for apps that already have a
 * public sign-up page: an unknown address then gets an account only when the
 * page asks with `signIn.social({ provider: "google", requestSignUp: true })`.
 * That flag comes from the browser, so it is not a gate, only a way to keep
 * the login screen from creating accounts by accident; never set
 * `allowSignUp` in an app whose accounts are invite-only.
 *
 * An existing account with the same email links on first use: Google marks
 * its emails verified, Better Auth's default linking rule.
 *
 * Returns `{}` until both keys are set, so an app without them mounts no
 * Google route at all.
 */
export function googleSocialProviders(
  { allowSignUp = false }: { allowSignUp?: boolean } = {},
  env: Record<string, string | undefined> = process.env,
) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return {
    google: {
      clientId,
      clientSecret,
      prompt: "select_account" as const,
      ...(allowSignUp ? { disableImplicitSignUp: true } : { disableSignUp: true }),
    },
  };
}

/** For the client: show the Google button only when the server mounted the provider. */
export function googleSignInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
