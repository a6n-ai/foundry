"use client";

import { useState, useTransition } from "react";
import { StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@foundry/ui/button";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { useDeliveryActions, type AddressInputSlot } from "./context";

/**
 * Every ring is measured from this one point, so it is a property of the shop
 * rather than of any zone — which is why it sits above the map instead of
 * inside the add-zone dialog.
 */
const PlainAddressInput: AddressInputSlot = ({ id, value, onChange }) => (
  <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Shop address" />
);

export function StoreOriginField({
  origin,
  onOriginResolved,
  addressInput: AddressInput = PlainAddressInput,
}: {
  origin: { lat: number; lng: number } | null;
  onOriginResolved: (lat: number, lng: number) => void;
  addressInput?: AddressInputSlot;
}) {
  const { saveStoreOriginFromAddress } = useDeliveryActions();
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [pending, start] = useTransition();

  function apply() {
    start(async () => {
      const res = await saveStoreOriginFromAddress({ placeId, address });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.lat != null && res.lng != null) {
        onOriginResolved(res.lat, res.lng);
        setAddress(res.formattedAddress ?? address);
        setPlaceId(undefined);
        toast.success("Shop location updated");
      }
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="store-origin" className="flex items-center gap-1.5">
          <StoreIcon className="size-3.5" />
          Shop location
        </Label>
        <AddressInput
          id="store-origin"
          value={address}
          onChange={(v) => {
            setAddress(v);
            // A typed edit invalidates the picked suggestion — resolving by a
            // stale placeId would move the shop to the previous address.
            setPlaceId(undefined);
          }}
          onPick={(r) => {
            setAddress(r.address);
            setPlaceId(r.placeId);
          }}
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {origin
            ? `Currently ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)} — search an address, or drag the pin on the map.`
            : "Not set — radius circles are measured from here."}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending || (!address.trim() && !placeId)}
        onClick={apply}
      >
        {pending ? "Locating…" : "Move shop here"}
      </Button>
    </div>
  );
}
