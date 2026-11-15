"use client";

import { Button } from "@foundry/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@foundry/ui/popover";
import type { AccessLevel } from "./access-model";

const LEVEL_TEXT: Record<AccessLevel, string> = { none: "No access", view: "View", edit: "Edit", full: "Full" };

export type AccessLevelCellProps = {
  level: AccessLevel;
  /** Actions the person holds in this resource (not the full catalogue). */
  actions: { action: string; label: string }[];
  /** action -> roles that grant it, for this resource only. */
  grants: Record<string, string[]>;
  resourceLabel: string;
};

export function AccessLevelCell({ level, actions, grants, resourceLabel }: AccessLevelCellProps) {
  if (level === "none" || actions.length === 0) {
    return <span className="text-sm text-muted-foreground">{LEVEL_TEXT.none}</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${resourceLabel}: ${LEVEL_TEXT[level]}`}>
          {LEVEL_TEXT[level]}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid gap-2">
        <p className="text-sm font-medium">{resourceLabel}</p>
        <ul className="grid gap-2">
          {actions.map((a) => (
            <li key={a.action} className="grid gap-0.5">
              <span className="text-sm">{a.label}</span>
              <span className="text-xs text-muted-foreground">
                Granted by {(grants[a.action] ?? []).join(", ") || "no role"}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
