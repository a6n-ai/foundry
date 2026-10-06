"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@foundry/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@foundry/ui/dialog";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";

export function AdjustCoinsDialog({
  balance,
  who,
  onSubmit,
}: {
  balance: number;
  who: string;
  onSubmit: (input: { coins: number; memo: string }) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"give" | "take">("give");
  const [coins, setCoins] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [pending, start] = React.useTransition();

  const submit = () => {
    const n = parseInt(coins, 10);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Enter a whole number of coins.");
      return;
    }
    if (!memo.trim()) {
      toast.error("Add a reason.");
      return;
    }
    start(async () => {
      const res = await onSubmit({ coins: mode === "give" ? n : -n, memo: memo.trim() });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "give" ? `Gave ${n} coins to ${who}` : `Took ${n} coins from ${who}`);
      setOpen(false);
      setCoins("");
      setMemo("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Give or take coins
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coins for {who}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">Current balance: {balance.toLocaleString()} coins</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "give" ? "default" : "outline"} onClick={() => setMode("give")}>
            Give
          </Button>
          <Button type="button" size="sm" variant={mode === "take" ? "default" : "outline"} onClick={() => setMode("take")}>
            Take
          </Button>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adjust-coins">Coins</Label>
          <Input id="adjust-coins" type="number" min={1} step={1} value={coins} onChange={(e) => setCoins(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adjust-memo">Reason</Label>
          <Input id="adjust-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Kite day raffle" />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
