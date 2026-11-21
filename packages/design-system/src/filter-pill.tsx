import type { ReactNode } from "react";
import { cn } from "@foundry/ui/cn";

/**
 * Status/chip control for FilterBar lists.
 * Visual ref: Beautiful UI Filter Table chips (dot + label + count).
 */
export function FilterPill({
  label,
  active,
  count,
  onClick,
  dot,
  leading,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  /** Optional status color (Filter Table). Prefer token colors when possible. */
  dot?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors sm:min-h-8",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {leading}
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "nums rounded-full px-1.5 text-xs tabular-nums",
            active ? "bg-primary-foreground/25" : "bg-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
