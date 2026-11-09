"use client";

import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";

// Google One Tap, sign-in only (server: googleOneTapPlugins). Its own client
// because the Client ID arrives from the server as a prop: no NEXT_PUBLIC_
// build arg to plumb through the Dockerfile. autoSelect signs a returning
// user in without a tap; Chrome spaces those out by 10 minutes, and the app's
// signOut must call preventGoogleAutoSignIn so sign-out never loops back in.
export function promptGoogleOneTap(
  clientId: string,
  handlers: { onSignedIn: () => void; onRefused?: () => void },
  baseURL: string | undefined,
) {
  // Google only accepts the client's registered origin; anywhere else (local builds, previews) every
  // attempt fails with a 403 in the console, so don't prompt there at all. No configured origin (a local
  // build without the deploy's env) counts as unregistered too.
  if (typeof window !== "undefined" && (!baseURL || new URL(baseURL).origin !== window.location.origin)) return Promise.resolve();
  const client = createAuthClient({
    baseURL,
    // maxAttempts 1: one prompt per visit, no re-prompting after a dismiss.
    plugins: [oneTapClient({ clientId, autoSelect: true, context: "signin", promptOptions: { maxAttempts: 1 } })],
  });
  return client.oneTap({ fetchOptions: { onSuccess: handlers.onSignedIn, onError: () => handlers.onRefused?.() } });
}
