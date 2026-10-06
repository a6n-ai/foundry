"use client";

import * as React from "react";
import { toast } from "sonner";
import { SectionCard } from "@foundry/design-system";
import { Button } from "@foundry/ui/button";
import { Label } from "@foundry/ui/label";
import { Skeleton } from "@foundry/ui/skeleton";
import { NumberField, ToggleRow } from "./fields";

const CARD_TITLE = "Event payouts";
const CARD_SUBTITLE =
  "Configure how many coins customers earn for each business event. Disabled events award no coins.";

export type PayoutRowInput = {
  event: string;
  label: string;
  description?: string;
  enabled: boolean;
  coins: number;
};

type SavePayout = (input: { event: string; enabled: boolean; coins: number }) => Promise<void>;

export function EventPayoutGrid({
  rows,
  onSave,
  emptyMessage = "No events to configure.",
}: {
  rows: PayoutRowInput[];
  onSave: SavePayout;
  emptyMessage?: string;
}) {
  return (
    <SectionCard title={CARD_TITLE} subtitle={CARD_SUBTITLE}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <PayoutRowItem key={row.event} row={row} onSave={onSave} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// Single source of truth for a payout row's layout: the real row and the skeleton
// twin both render through this shell, so the loading state can't drift from it.
function PayoutRowShell({
  label,
  toggle,
  field,
  action,
}: {
  label: React.ReactNode;
  toggle: React.ReactNode;
  field: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {label}
        {toggle}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {field}
        {action}
      </div>
    </div>
  );
}

function PayoutRowItem({ row, onSave }: { row: PayoutRowInput; onSave: SavePayout }) {
  const [pending, start] = React.useTransition();
  const [enabled, setEnabled] = React.useState(row.enabled);
  const [coins, setCoins] = React.useState(String(row.coins));

  const save = () => {
    const n = parseInt(coins, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Coins must be a non-negative integer");
      return;
    }
    start(async () => {
      try {
        await onSave({ event: row.event, enabled, coins: n });
        toast.success(`${row.label} saved`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  return (
    <PayoutRowShell
      label={
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">{row.label}</span>
          {row.description ? <span className="text-muted-foreground text-xs">{row.description}</span> : null}
        </div>
      }
      toggle={
        <ToggleRow id={`payout-${row.event}-enabled`} label="Enabled" checked={enabled} onChange={setEnabled} inline />
      }
      field={
        <NumberField
          id={`payout-${row.event}-coins`}
          label="Coins"
          min={0}
          step={1}
          value={coins}
          onChange={setCoins}
          className="w-36"
        />
      }
      action={
        <Button onClick={save} disabled={pending} size="sm" variant="outline">
          Save
        </Button>
      }
    />
  );
}

// Exact loading twin: same SectionCard copy + same PayoutRowShell layout.
export function EventPayoutGridSkeleton() {
  return (
    <SectionCard title={CARD_TITLE} subtitle={CARD_SUBTITLE}>
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <PayoutRowShell
            key={i}
            label={<Skeleton className="h-4 w-32" />}
            toggle={
              <div className="flex items-center gap-2">
                <Label className="text-sm">Enabled</Label>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            }
            field={
              <div className="grid w-36 gap-1.5">
                <Label>Coins</Label>
                <Skeleton className="h-9 w-full" />
              </div>
            }
            action={<Skeleton className="h-8 w-16" />}
          />
        ))}
      </div>
    </SectionCard>
  );
}
