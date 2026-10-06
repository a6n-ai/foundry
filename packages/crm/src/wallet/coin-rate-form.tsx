"use client";

import * as React from "react";
import { toast } from "sonner";
import { SectionCard } from "@foundry/design-system";
import { Button } from "@foundry/ui/button";
import { Label } from "@foundry/ui/label";
import { NumberField } from "./fields";

export function CoinRateForm({
  currency,
  current,
  onSave,
}: {
  currency: string;
  current: { valuePerCoin: string } | null;
  onSave: (input: { currency: string; valuePerCoin: number }) => Promise<void>;
}) {
  const [pending, start] = React.useTransition();
  const [valuePerCoin, setValuePerCoin] = React.useState(current ? String(Number(current.valuePerCoin)) : "0.1");

  const save = () => {
    const n = parseFloat(valuePerCoin);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Value per coin must be a positive number");
      return;
    }
    start(async () => {
      try {
        await onSave({ currency, valuePerCoin: n });
        toast.success("Coin rate saved — new rate is now active");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  return (
    <SectionCard
      title="Coin rate"
      subtitle={`Sets the ${currency} value of one coin. Each save creates a versioned rate record; historical rates are preserved.`}
    >
      <div className="grid max-w-sm gap-4">
        <div className="grid gap-1.5">
          <Label>Currency</Label>
          <p className="text-sm font-medium">{currency}</p>
        </div>
        <NumberField
          id="coin-rate-value"
          label={`Value per coin (${currency})`}
          prefix="$"
          min={0.0001}
          step={0.001}
          value={valuePerCoin}
          onChange={setValuePerCoin}
        />
        {current && (
          <p className="text-muted-foreground text-xs">
            Current rate: ${Number(current.valuePerCoin).toFixed(4)} {currency}
          </p>
        )}
        <Button onClick={save} disabled={pending} className="w-fit">
          Save rate
        </Button>
      </div>
    </SectionCard>
  );
}
