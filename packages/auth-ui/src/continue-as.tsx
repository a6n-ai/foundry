"use client";

import { useState } from "react";
import { AUTH_LINK } from "./email-code-sign-in";
import { resolveUi, type AuthUi } from "./ui";

export type ContinueAsUser = {
  firstName: string;
  email: string;
  maskedEmail: string;
  method: "google" | "email" | "password";
  image?: string;
};

export interface ContinueAsProps {
  user: ContinueAsUser;
  /** Google: start OAuth with loginHint; email: prefill the code form. Google navigates away. */
  onContinue: () => unknown;
  onOther: () => void;
  /** Clear the last-user cookie. */
  onForget: () => void;
  /** Optional sign-up link, e.g. "New here? Create an account". */
  getStarted?: { label: string; onClick: () => void };
  ui?: Partial<AuthUi>;
}

/**
 * "Welcome back" account card for the last person who signed in on this
 * device (from the last-user cookie): who, one obvious Continue, then the
 * ways out. Canva-style, grouped under the heading.
 */
export function ContinueAs({ user, onContinue, onOther, onForget, getStarted, ui }: ContinueAsProps) {
  const { Button } = resolveUi(ui);
  const [pending, setPending] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = (user.firstName || user.email).charAt(0).toUpperCase();
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col items-center gap-3 text-center">
        {user.image && !photoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google photo or the app's file store, not a static asset
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setPhotoFailed(true)}
            className="border-border size-20 rounded-full border object-cover"
          />
        ) : (
          <span aria-hidden className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-full text-[28px] font-semibold">
            {initial}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          {user.firstName ? <p className="text-[17px] font-semibold">{user.firstName}</p> : null}
          <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">{user.email}</p>
        </div>
      </div>
      <Button
        variant="primary"
        className="w-full"
        pending={pending}
        onClick={async () => {
          setPending(true);
          await onContinue();
          setPending(false);
        }}
      >
        Continue
      </Button>
      <div className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden>
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <Button variant="outline" className="w-full" onClick={onOther}>
        Continue with another account
      </Button>
      <div className="flex flex-col items-center">
        <button type="button" onClick={onForget} className={AUTH_LINK}>
          Not you? Remove this account
        </button>
        {getStarted ? (
          <button type="button" onClick={getStarted.onClick} className={AUTH_LINK}>
            {getStarted.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
