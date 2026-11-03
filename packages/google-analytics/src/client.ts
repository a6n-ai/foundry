"use client";

type Gtag = (cmd: "event", name: string, params?: Record<string, unknown>) => void;

/** Browser GA4 event. No-ops until gtag loads (consent, script blocked) and on staff pages. GA tracks page views itself. */
export function gtagEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function" || location.pathname.startsWith("/dashboard")) return;
  gtag("event", name, params);
}
