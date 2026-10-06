"use client";

import { useEffect, useRef } from "react";

export interface GoogleOneTapProps {
  /**
   * Shows the prompt, e.g. a Better Auth client with `oneTapClient({ clientId,
   * autoSelect: true })` calling `.oneTap({ fetchOptions: { onSuccess } })`.
   * Kept as a callback so this package stays free of the auth client.
   */
  start: () => Promise<unknown>;
}

/**
 * Google One Tap on mount. Renders nothing: the browser draws the prompt.
 * Mount it only for signed-out visitors on sign-in pages, never site-wide,
 * and sign-out must call `navigator.credentials.preventSilentAccess()`, or
 * auto-select signs the user straight back in (see `preventGoogleAutoSignIn`).
 */
export function GoogleOneTap({ start }: GoogleOneTapProps) {
  const started = useRef(false);
  useEffect(() => {
    // Once per mount: React's dev double-effect would prompt twice.
    if (started.current) return;
    started.current = true;
    start().catch(() => {
      /* No Google session, blocked third-party sign-in, dismissed: the button stays. */
    });
  }, [start]);
  return null;
}

/** Call on sign-out so FedCM auto-select does not sign the user straight back in. */
export async function preventGoogleAutoSignIn(): Promise<void> {
  try {
    await navigator.credentials?.preventSilentAccess?.();
  } catch {
    /* Not supported: nothing to clear. */
  }
}
