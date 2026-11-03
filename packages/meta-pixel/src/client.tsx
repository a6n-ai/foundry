"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Fbq = (cmd: "track", event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => void;

/**
 * Browser Pixel event. Pass the same `eventID` as the server's event_id so Meta counts the pair
 * once. No-ops until the bootstrap defines fbq (consent, script blocked) and on staff pages.
 */
export function trackMeta(eventName: string, params: Record<string, unknown> = {}, eventID?: string): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function" || location.pathname.startsWith("/dashboard")) return;
  const id = eventID?.trim();
  fbq("track", eventName, params, id ? { eventID: id } : undefined);
}

/** Client navigations don't reload the page, so PageView is sent here; the bootstrap sends the first one. */
export function MetaPixelPageViews() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackMeta("PageView");
  }, [pathname]);
  return null;
}
