"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@foundry/ui/select";

export type MemberRoleSelectProps = {
  value: string;
  options: { value: string; label: string; locked?: boolean }[];
  disabled?: boolean;
  onChange: (role: string) => Promise<{ error?: string }>;
};

export function MemberRoleSelect({ value, options, disabled, onChange }: MemberRoleSelectProps) {
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function change(role: string) {
    const prev = current;
    setCurrent(role);
    setError(undefined);
    start(async () => {
      const res = await onChange(role);
      if (res.error) {
        setCurrent(prev);
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-1">
      <Select value={current} onValueChange={change} disabled={disabled || pending}>
        <SelectTrigger aria-invalid={Boolean(error)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.locked}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
