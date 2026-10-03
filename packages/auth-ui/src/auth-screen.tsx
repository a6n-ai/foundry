"use client";

import type { ReactNode } from "react";
import { resolveUi, type AuthUi } from "./ui";

export interface AuthScreenProps {
  children: ReactNode;
  /** Legal links, support, etc. Sits under the panel. */
  footer?: ReactNode;
  className?: string;
}

/**
 * The sign-in panel every app's auth pages share. Bare on phones, so the form
 * sits on the app's own page background with nothing boxing it in; a card
 * from `sm` up, where a floating panel reads as intended rather than cramped.
 * Colors come only from theme tokens, so each app's design system skins it.
 */
export function AuthScreen({ children, footer, className }: AuthScreenProps) {
  return (
    <div className={`mx-auto flex w-full max-w-[420px] flex-1 flex-col ${className ?? ""}`}>
      <div className="flex flex-1 flex-col sm:bg-card sm:text-card-foreground sm:flex-none sm:rounded-2xl sm:p-10 sm:shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-14px_rgb(0_0_0/0.22)]">
        {children}
      </div>
      {footer ? (
        <div className="text-muted-foreground mt-6 text-balance text-center text-xs [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export interface AuthWelcomeProps {
  /** The app's mark or illustration. Rendered large; bring your own sizing. */
  art: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  primary: { label: ReactNode; onClick: () => void };
  secondary?: { label: ReactNode; onClick: () => void };
  ui?: Partial<AuthUi>;
}

/**
 * Welcome screen shown before sign-in: the app's mark, one line of who it is,
 * and the two ways forward. Not a timed splash; nothing auto-advances, so it
 * never stands between a returning user and the form for longer than one tap.
 * On phones the actions sit at the bottom, in thumb reach.
 */
export function AuthWelcome({ art, title, tagline, primary, secondary, ui }: AuthWelcomeProps) {
  const { Button } = resolveUi(ui);
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center sm:py-4">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 duration-700 ease-out">{art}</div>
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 fill-mode-both flex flex-col gap-2 delay-150 duration-700 ease-out">
          <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-[-0.022em]">{title}</h1>
          {tagline ? <p className="text-muted-foreground mx-auto max-w-[30ch] text-balance text-[17px] leading-snug">{tagline}</p> : null}
        </div>
      </div>
      <div className="motion-safe:animate-in motion-safe:fade-in fill-mode-both flex flex-col gap-3 pb-2 delay-300 duration-500 ease-out sm:mt-8 sm:pb-0">
        <Button variant="primary" className="w-full" onClick={primary.onClick}>
          {primary.label}
        </Button>
        {secondary ? (
          <Button variant="quiet" className="w-full" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
