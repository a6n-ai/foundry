"use client";

import { useState } from "react";
import { authErrorMessage, errorOf } from "./errors";
import { resolveUi, type AuthUi } from "./ui";

export interface GoogleConnectionProps {
  /** Null while the app is still loading the account's linked providers. */
  connected: boolean | null;
  /** Starts the link redirect, e.g. `authClient.linkSocial({ provider: "google", callbackURL })`. */
  onConnect: () => Promise<unknown>;
  /** e.g. `authClient.unlinkAccount({ providerId: "google" })`. Resolve `{ error }` to show it. */
  onDisconnect: () => Promise<unknown>;
  ui?: Partial<AuthUi>;
}

/**
 * "Google: connected / Connect" for account settings. Disconnect asks once
 * before acting; signing in by email code keeps working either way, so it
 * never strands the account.
 */
export function GoogleConnection({ connected, onConnect, onDisconnect, ui }: GoogleConnectionProps) {
  const { Button, Notice } = resolveUi(ui);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    let err: ReturnType<typeof errorOf>;
    try {
      err = errorOf(await action());
    } catch {
      err = {};
    }
    setPending(false);
    setConfirming(false);
    if (err) setError(authErrorMessage(err, "send"));
  }

  if (connected === null) return <p className="text-muted-foreground text-sm">Checking…</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {connected
          ? "Google is connected. You can sign in with Google or with an email code."
          : "Connect Google to sign in with one tap. It must use this account's email."}
      </p>
      {connected && confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">Disconnect Google? You'll sign in with an email code instead.</p>
          <div className="flex gap-2">
            <Button variant="danger" pending={pending} onClick={() => void run(onDisconnect)}>
              Disconnect
            </Button>
            <Button variant="quiet" disabled={pending} onClick={() => setConfirming(false)}>
              Keep connected
            </Button>
          </div>
        </div>
      ) : connected ? (
        <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          Disconnect Google
        </Button>
      ) : (
        <Button variant="outline" className="self-start" pending={pending} pendingLabel="Opening Google…" onClick={() => void run(onConnect)}>
          Connect Google
        </Button>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
