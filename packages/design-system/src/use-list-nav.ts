"use client";
import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

// Pagination, sort and filters each own their own transition, but the table is
// what should look busy. A module-level count of in-flight list navigations
// lets any DataTable on the page dim while any of its controls is loading.
let inFlight = 0;
const listeners = new Set<() => void>();
const bump = (d: number) => {
  inFlight += d;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useListNavPending(): boolean {
  return useSyncExternalStore(subscribe, () => inFlight > 0, () => false);
}

/** Navigates in a transition (old rows stay up) and flags the list as loading meanwhile. */
export function useListNav(): (href: string, mode?: "push" | "replace") => void {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!pending) return;
    bump(1);
    return () => bump(-1);
  }, [pending]);
  return useCallback(
    (href, mode = "replace") => start(() => router[mode](href, { scroll: false })),
    [router],
  );
}
