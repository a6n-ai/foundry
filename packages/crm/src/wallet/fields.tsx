"use client";

import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { Switch } from "@foundry/ui/switch";
import { cn } from "@foundry/ui/cn";

/** Moved from tiffin-grab discounts/controls.tsx for the shared wallet screens. */
export function NumberField({
  id, label, value, onChange, prefix, suffix, min, max, step, placeholder, className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step ?? "any"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-8")}
        />
        {suffix && (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function ToggleRow({
  id, label, hint, checked, onChange, inline,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-muted-foreground text-xs text-pretty">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
