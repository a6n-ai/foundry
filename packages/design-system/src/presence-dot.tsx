"use client";

import { cn } from "@foundry/ui/cn";

export function PresenceDot({ online, label }: { online: boolean; label: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" aria-live="polite">
      <span
        className={cn("size-2 rounded-full", online ? "bg-ok" : "bg-muted-foreground/40")}
        aria-hidden
      />
      {label} {online ? "online" : "offline"}
    </span>
  );
}
