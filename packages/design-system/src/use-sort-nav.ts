"use client";
import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useListNav } from "./use-list-nav";

// Single source of sort-nav truth: pushes ?sort=<column>&dir=<dir>, preserving
// other params. Used by both the desktop SortableHeader and the mobile Sort
// dropdown so the two can't diverge.
export function useSortNav(): (column: string, dir: "asc" | "desc") => void {
  const nav = useListNav();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (column, dir) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("sort", column);
      sp.set("dir", dir);
      nav(`${pathname}?${sp.toString()}`, "push");
    },
    [nav, pathname, params],
  );
}
