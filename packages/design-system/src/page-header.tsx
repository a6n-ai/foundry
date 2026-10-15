import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      {/* The title keeps 14rem; actions that do not fit beside it wrap under it instead of squeezing it. */}
      <div className="group flex min-w-56 flex-1 items-start gap-3">
        <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg md:size-10">
          <Icon className="icon-pop size-5" />
        </span>
        <div className="min-w-0 space-y-0.5 md:space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm text-pretty md:max-w-prose md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
