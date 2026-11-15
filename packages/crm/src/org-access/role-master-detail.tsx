"use client";

import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@foundry/ui/button";
import { cn } from "@foundry/ui/cn";

export type RoleMasterDetailProps = {
  list: ReactNode;
  detail: ReactNode;
  selectedId: string | null;
  /** Shown on small screens when a detail is open; clears the selection. */
  mobileBack: { label: string; onBack: () => void };
};

export function RoleMasterDetail({ list, detail, selectedId, mobileBack }: RoleMasterDetailProps) {
  const open = selectedId !== null;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className={cn(open && "hidden md:block")}>{list}</div>
      <div className={cn("grid content-start gap-4", !open && "hidden md:grid")}>
        <div className="md:hidden">
          <Button variant="ghost" size="sm" onClick={mobileBack.onBack}>
            <ChevronLeftIcon />
            {mobileBack.label}
          </Button>
        </div>
        {detail}
      </div>
    </div>
  );
}
