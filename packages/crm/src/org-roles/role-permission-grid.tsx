"use client";

import { Checkbox } from "@foundry/ui/checkbox";
import { Label } from "@foundry/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@foundry/ui/tooltip";
import { isGrantable, togglePermission, type PermissionMap, type ResourceLabel } from "./permission-map";

export type RolePermissionGridProps = {
  resources: ResourceLabel[];
  value: PermissionMap;
  grantable: PermissionMap;
  onChange: (value: PermissionMap) => void;
  readOnly?: boolean;
};

export function RolePermissionGrid({ resources, value, grantable, onChange, readOnly }: RolePermissionGridProps) {
  return (
    <TooltipProvider>
      <div className="grid gap-4">
        {resources.map((r) => (
          <div key={r.resource} className="grid gap-2">
            <p className="text-sm font-medium">{r.label}</p>
            <div className="flex flex-wrap gap-4">
              {r.actions.map((a) => {
                const allowed = isGrantable(grantable, r.resource, a.action);
                const id = `perm-${r.resource}-${a.action}`;
                const box = (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={value[r.resource]?.includes(a.action) ?? false}
                      disabled={readOnly || !allowed}
                      onCheckedChange={() => onChange(togglePermission(value, r.resource, a.action, grantable))}
                    />
                    <Label htmlFor={id} className="text-sm font-normal">
                      {a.label}
                    </Label>
                  </div>
                );
                if (allowed) return <div key={a.action}>{box}</div>;
                return (
                  <Tooltip key={a.action}>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>{box}</span>
                    </TooltipTrigger>
                    <TooltipContent>You don&apos;t have this permission</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
