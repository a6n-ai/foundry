"use client";

import type { ReactNode } from "react";
import { Badge } from "@foundry/ui/badge";
import type { SavedAddress } from "../rules";

export function formatAddress(a: Pick<SavedAddress, "addressLine" | "addressUnit" | "city" | "postalCode">): string {
  return [a.addressUnit ? `${a.addressUnit} – ${a.addressLine}` : a.addressLine, a.city, a.postalCode].join(", ");
}

export function AddressCard({ address, actions }: { address: SavedAddress; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          {address.label}
          {address.isDefault && <Badge variant="secondary">Default</Badge>}
        </p>
        <p className="text-muted-foreground truncate text-sm">{formatAddress(address)}</p>
        {address.deliveryInstructions && <p className="text-muted-foreground text-xs">{address.deliveryInstructions}</p>}
      </div>
      {actions}
    </div>
  );
}
