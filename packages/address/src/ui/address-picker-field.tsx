"use client";

import type { SavedAddress } from "../rules";
import { formatAddress } from "./address-card";

/** Staff radio list of a customer's saved addresses (e.g. per-delivery change). */
export function AddressPickerField({
  addresses,
  value,
  onChange,
}: {
  addresses: SavedAddress[];
  value: string | null;
  onChange: (publicId: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Saved addresses" className="grid gap-2">
      {addresses.map((a) => (
        <label key={a.publicId} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
          <input type="radio" name="address" checked={value === a.publicId} onChange={() => onChange(a.publicId)} className="mt-1" />
          <span>
            <span className="font-medium">{a.label}</span>
            {a.isDefault && <span className="text-muted-foreground"> · Default</span>}
            <span className="text-muted-foreground block">{formatAddress(a)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
