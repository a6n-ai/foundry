"use client";
import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useListNav } from "./use-list-nav";

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
