"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@foundry/ui/button";
import { ZoneMap, type MapZone } from "./zone-map";
import { ZonesTable } from "./zones-table";
import { ZoneEditDialog } from "./zone-edit-dialog";
import { StoreOriginField } from "./store-origin-field";
import { useDeliveryActions, type AddressInputSlot, type TypeOption, type ZoneRow } from "./context";

const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

/** Blank row that puts the dialog into create mode. */
const NEW_ZONE: ZoneRow = {
  publicId: "",
  name: "",
  radiusKm: null,
  postalPrefixes: [],
  slotWindow: null,
  active: true,
  typePublicIds: [],
};

export function DeliveryZonesManager({
  mapStyleUrl = null,
  origin: initialOrigin,
  zones: initialZones,
  types,
  addressInput,
}: {
  /** Vector style URL for the basemap; null falls back to keyless OSM raster. */
  mapStyleUrl?: string | null;
  /** Centre of radius circles; null until the shop location is set. */
  origin: { lat: number; lng: number } | null;
  zones: ZoneRow[];
  types: TypeOption[];
  /** The app's address search input for the shop location (e.g. Places autocomplete). */
  addressInput?: AddressInputSlot;
}) {
  const router = useRouter();
  const actions = useDeliveryActions();
  const [origin, setOrigin] = useState(initialOrigin);
  // Drag-time overrides ONLY — the server value is the default, so a radius saved
  // elsewhere (the edit dialog) shows up after router.refresh().
  const [radiusOverrides, setRadiusOverrides] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [, startOrigin] = useTransition();
  const [, startRadiusCommit] = useTransition();

  const circles = initialZones.filter((z) => z.radiusKm != null);

  // Colours assigned by sorted radius so the smallest ring keeps its hue across renders.
  const colorByPublicId = useMemo(() => {
    const sorted = circles.filter((z) => z.active).sort((a, b) => (a.radiusKm ?? 0) - (b.radiusKm ?? 0));
    return new Map(sorted.map((z, i) => [z.publicId, PALETTE[i % PALETTE.length]!]));
  }, [circles]);

  const mapZones: MapZone[] = circles.map((z) => ({
    publicId: z.publicId,
    name: z.name,
    radiusKm: radiusOverrides[z.publicId] ?? (z.radiusKm as number),
    active: z.active,
    color: colorByPublicId.get(z.publicId) ?? "#2563eb",
  }));

  function commitOrigin(lat: number, lng: number) {
    setOrigin({ lat, lng });
    startOrigin(async () => {
      const res = await actions.saveStoreOrigin(lat, lng);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Shop location updated");
      router.refresh();
    });
  }

  function commitRadius(publicId: string, radiusKm: number) {
    const zone = circles.find((z) => z.publicId === publicId);
    if (!zone) return;
    startRadiusCommit(async () => {
      const res = await actions.saveZone({
        publicId,
        name: zone.name,
        radiusKm,
        postalPrefixes: [],
        slotWindow: zone.slotWindow,
        active: zone.active,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Clear the override so the refreshed (server re-clamped) value takes over.
      setRadiusOverrides((r) => {
        const next = { ...r };
        delete next[publicId];
        return next;
      });
      toast.success(`${zone.name} updated`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <StoreOriginField
        origin={origin}
        addressInput={addressInput}
        onOriginResolved={(lat, lng) => {
          // The action already persisted it; just move the pin and rings.
          setOrigin({ lat, lng });
          router.refresh();
        }}
      />
      {origin && (
        <>
          <ZoneMap
            origin={origin}
            zones={mapZones}
            focusedPublicId={focused}
            onRadiusChange={(publicId, radiusKm) => setRadiusOverrides((r) => ({ ...r, [publicId]: radiusKm }))}
            onRadiusCommit={commitRadius}
            onOriginChange={commitOrigin}
            styleUrl={mapStyleUrl}
          />
          <p className="text-muted-foreground text-xs">
            Drag the shop pin to move the origin, or drag a ring&rsquo;s edge to resize it. Postal-code zones
            aren&rsquo;t drawn — they&rsquo;re matched first, before any ring.
          </p>
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(NEW_ZONE)}>
          <PlusIcon />
          Add zone
        </Button>
      </div>

      <ZonesTable
        zones={initialZones}
        mapZones={mapZones}
        types={types}
        focusedPublicId={focused}
        onFocus={setFocused}
        onEdit={setEditing}
      />

      {/* key remounts the form per row so its fields reseed from the new zone. */}
      <ZoneEditDialog
        key={editing?.publicId || (editing ? "new" : "none")}
        zone={editing}
        allZones={mapZones}
        types={types}
        origin={origin}
        mapStyleUrl={mapStyleUrl}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
