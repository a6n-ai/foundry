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

export interface AuthPanelProps {
  /** The app's logo. Shown once, top-left; bring your own sizing. */
  art: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  children: ReactNode;
}

/**
 * The one design language every auth screen shares: a fixed, left-aligned
 * header (logo, title, tagline) over a single task. Hosts retitle per step
 * (Revolut-style "Welcome back" -> "Enter the code"); the title swaps softly
 * in place while the logo above stays put.
 */
export function AuthPanel({ art, title, tagline, children }: AuthPanelProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex flex-col items-start gap-5 pt-2 text-left">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 origin-left duration-700 ease-out">{art}</div>
        <div
          key={typeof title === "string" ? title : undefined}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 fill-mode-both flex flex-col gap-2 duration-500 ease-out"
        >
          <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.025em]">{title}</h1>
          {tagline ? <p className="text-muted-foreground max-w-[34ch] text-pretty text-[17px] leading-snug">{tagline}</p> : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export interface AuthWelcomeProps extends Omit<AuthPanelProps, "children"> {
  primary: { label: ReactNode; onClick: () => void };
  secondary?: { label: ReactNode; onClick: () => void };
  /**
   * The active sign-in step (e.g. <EmailCodeSignIn compact />). When set it
   * replaces the two actions below the header.
   */
  children?: ReactNode;
  ui?: Partial<AuthUi>;
}

/**
 * Welcome + sign-in on one screen: AuthPanel whose body starts as the two ways
 * forward and swaps to whichever form the user picked. Not a timed splash;
 * nothing auto-advances. On phones the actions sit at the bottom, in thumb reach.
 */
export function AuthWelcome({ primary, secondary, children, ui, ...head }: AuthWelcomeProps) {
  const { Button } = resolveUi(ui);
  return (
    <AuthPanel {...head}>
      {children ?? (
        <div className="motion-safe:animate-in motion-safe:fade-in fill-mode-both mt-auto flex flex-col gap-3 delay-200 duration-500 ease-out">
          <Button variant="primary" className="w-full" onClick={primary.onClick}>
            {primary.label}
          </Button>
          {secondary ? (
            <Button variant="outline" className="w-full" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          ) : null}
        </div>
      )}
    </AuthPanel>
  );
}
