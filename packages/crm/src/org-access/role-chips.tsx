"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@foundry/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@foundry/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@foundry/ui/tooltip";

export type ChipOp = "add" | "remove";

export type ChipContext = {
  /** The row being edited is the viewer's own row. */
  self: boolean;
  /** Roles the row holds now. */
  roleCount: number;
  /** Role whose removal would leave the org with no owner, if any. */
  lastOwnerRole?: string;
  /** Roles ranked at or above the viewer's own. */
  aboveViewer: string[];
};

export function chipState(role: string, op: ChipOp, ctx: ChipContext): string | null {
  if (ctx.self) return "You can't change your own roles";
  if (op === "remove" && ctx.roleCount <= 1) return "A person needs at least one role";
  if (op === "remove" && role === ctx.lastOwnerRole) return "This is the last owner role";
  if (ctx.aboveViewer.includes(role)) return "This role is above yours";
  return null;
}

export type RoleChipsProps = {
  roles: string[];
  options: { value: string; label: string }[];
  onAdd: (role: string) => Promise<{ error?: string }>;
  onRemove: (role: string) => Promise<{ error?: string }>;
  disabledReason: (role: string, op: ChipOp) => string | null;
};

export function RoleChips({ roles, options, onAdd, onRemove, disabledReason }: RoleChipsProps) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(role: string, op: ChipOp) {
    const fn = op === "add" ? onAdd : onRemove;
    setError(undefined);
    start(async () => {
      let res: { error?: string };
      try {
        res = await fn(role);
      } catch (err) {
        res = { error: err instanceof Error && err.message ? err.message : "Something went wrong. Try again." };
      }
      if (res.error) setError(res.error);
    });
  }

  const addable = options.filter((o) => !roles.includes(o.value));

  return (
    <TooltipProvider>
      <div className="grid gap-2">
        <ul className="flex flex-wrap gap-2">
          {roles.map((role) => {
            const label = options.find((o) => o.value === role)?.label ?? role;
            const reason = disabledReason(role, "remove");
            const remove = (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={reason ? `Remove ${label}: ${reason}` : `Remove ${label}`}
                disabled={pending || reason !== null}
                onClick={() => run(role, "remove")}
              >
                <XIcon />
              </Button>
            );
            return (
              <li key={role} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm">
                <span>{label}</span>
                {reason ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>{remove}</span>
                    </TooltipTrigger>
                    <TooltipContent>{reason}</TooltipContent>
                  </Tooltip>
                ) : (
                  remove
                )}
              </li>
            );
          })}
        </ul>
        {addable.length > 0 && (
          <Select value="" onValueChange={(role) => run(role, "add")} disabled={pending}>
            <SelectTrigger aria-label="Add role" aria-invalid={Boolean(error)} className="w-full sm:w-56">
              <SelectValue placeholder="Add role" />
            </SelectTrigger>
            <SelectContent>
              {addable.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={disabledReason(o.value, "add") !== null}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
