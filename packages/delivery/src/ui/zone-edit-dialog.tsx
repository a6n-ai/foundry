"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@foundry/ui/dialog";
import { Button } from "@foundry/ui/button";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { Switch } from "@foundry/ui/switch";
import { normalizePostal } from "../zones";
import { ZoneMap, clampMapRadius, type MapZone } from "./zone-map";
import { useDeliveryActions, type TypeOption, type ZoneRow } from "./context";

/**
 * Radius bounds from the neighbouring rings. Mirrors the server-side clamp — this copy
 * only drives the input's min/max and the hint; the server stays authoritative.
 */
function boundsFor(allZones: MapZone[], radiusKm: number, publicId: string | undefined) {
  const others = allZones.filter((z) => z.active && z.publicId !== publicId);
  const smaller = others.map((z) => z.radiusKm).filter((r) => r < radiusKm);
  const larger = others.map((z) => z.radiusKm).filter((r) => r > radiusKm);
  return {
    innerEdgeKm: smaller.length ? Math.max(...smaller) : 0,
    min: smaller.length ? Math.max(...smaller) + 0.01 : 0.01,
    max: larger.length ? Math.min(...larger) - 0.01 : undefined,
  };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const parsePrefixes = (text: string) => [...new Set(text.split(/[\s,]+/).map(normalizePostal).filter(Boolean))];

type Shape = "postal" | "circle";

export function ZoneEditDialog({
  zone,
  allZones,
  types,
  origin,
  mapStyleUrl,
  onOpenChange,
  onSaved,
}: {
  /** null closes the dialog; a zone with no publicId opens it in create mode. */
  zone: ZoneRow | null;
  /** Circle zones only — the rings drawn for context. */
  allZones: MapZone[];
  types: TypeOption[];
  /** Shared shop origin; null until set, which disables circle zones. */
  origin: { lat: number; lng: number } | null;
  mapStyleUrl: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const actions = useDeliveryActions();
  const isNew = zone !== null && zone.publicId === "";
  const [shape, setShape] = useState<Shape>(zone?.radiusKm != null ? "circle" : "postal");
  const [name, setName] = useState(zone?.name ?? "");
  const [prefixText, setPrefixText] = useState((zone?.postalPrefixes ?? []).join(", "));
  const [slotWindow, setSlotWindow] = useState(zone?.slotWindow ?? "");
  const [radiusKm, setRadiusKm] = useState(zone?.radiusKm ?? 5);
  // The text the field shows is separate from the committed number: a partially
  // typed value ("", "1", "1.") is not a radius yet.
  const [radiusText, setRadiusText] = useState(String(zone?.radiusKm ?? 5));
  const [active, setActive] = useState(zone?.active ?? true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(zone?.typePublicIds ?? []);
  const [pending, start] = useTransition();
  const [retiring, startRetire] = useTransition();

  const editingId = zone?.publicId || "__new__";
  // Bounds come from the COMMITTED radius, so the hint stays stable while typing.
  const bounds = boundsFor(allZones, radiusKm, zone?.publicId || undefined);
  const busy = pending || retiring;
  const activeTypes = types.filter((t) => t.active);

  /** Parse, clamp and adopt on blur; restore the last good value if unparseable. */
  function commitRadius() {
    const parsed = Number(radiusText.trim());
    if (!radiusText.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setRadiusText(String(radiusKm));
      return;
    }
    const clamped = clampMapRadius(parsed, allZones, editingId);
    setRadiusKm(clamped);
    setRadiusText(String(clamped));
  }

  // Every ring for context, with THIS one carrying the value being edited.
  const mapZones: MapZone[] = [
    ...allZones.filter((z) => z.publicId !== editingId),
    {
      publicId: editingId,
      name: name || "This zone",
      radiusKm,
      active: true,
      color: allZones.find((z) => z.publicId === editingId)?.color ?? "#2563eb",
    },
  ];

  function adoptRadius(_publicId: string, next: number) {
    setRadiusKm(next);
    setRadiusText(String(Math.round(next * 100) / 100));
  }

  function toggleType(publicId: string) {
    setSelectedTypes((prev) => (prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]));
  }

  function save() {
    let radiusToSave: number | null = null;
    if (shape === "circle") {
      // Blur may not have fired if Save was clicked straight from the field.
      const typed = Number(radiusText.trim());
      radiusToSave =
        radiusText.trim() && Number.isFinite(typed) && typed > 0 ? clampMapRadius(typed, allZones, editingId) : radiusKm;
    }
    start(async () => {
      const res = await actions.saveZone({
        publicId: isNew ? null : (zone?.publicId ?? null),
        name,
        radiusKm: radiusToSave,
        postalPrefixes: shape === "postal" ? parsePrefixes(prefixText) : [],
        slotWindow: slotWindow || null,
        active,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const publicId = isNew ? res.publicId : zone?.publicId;
      if (publicId && types.length > 0) {
        const typesRes = await actions.setZoneTypes(publicId, selectedTypes);
        if (typesRes.error) {
          toast.error(typesRes.error);
          return;
        }
      }
      toast.success(isNew ? "Zone created" : "Zone saved");
      onSaved();
      onOpenChange(false);
    });
  }

  function retire() {
    if (!zone || isNew) return;
    startRetire(async () => {
      const res = await actions.retireZone(zone.publicId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Zone retired");
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={zone !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add zone" : `Edit ${zone?.name || "zone"}`}</DialogTitle>
          <DialogDescription>
            A list of postal prefixes, or a ring measured out from the shop. Postal zones are matched first.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div role="radiogroup" aria-label="Zone shape" className="grid grid-cols-2 gap-2">
            {(["postal", "circle"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                role="radio"
                aria-checked={shape === s}
                variant={shape === s ? "default" : "outline"}
                disabled={s === "circle" && !origin}
                onClick={() => setShape(s)}
              >
                {s === "postal" ? "Postal codes" : "Radius circle"}
              </Button>
            ))}
          </div>
          {!origin && (
            <p className="text-muted-foreground text-xs">Set the shop location first to draw radius circles.</p>
          )}

          {shape === "circle" && origin && (
            // The shop pin is fixed here: the origin is shared by every ring, so moving it
            // from inside one zone's dialog would silently reshape the others.
            <ZoneMap
              origin={origin}
              zones={mapZones}
              focusedPublicId={editingId}
              onRadiusChange={adoptRadius}
              onRadiusCommit={adoptRadius}
              onOriginChange={() => {}}
              originDraggable={false}
              styleUrl={mapStyleUrl}
              heightPx={220}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Name</Label>
              <Input id="zone-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown" />
            </div>
            {shape === "circle" ? (
              <div className="space-y-1.5">
                <Label htmlFor="zone-radius">Outer radius (km)</Label>
                <Input
                  id="zone-radius"
                  type="number"
                  inputMode="decimal"
                  min={bounds.min}
                  max={bounds.max}
                  step={0.5}
                  className="tabular-nums"
                  aria-describedby="zone-radius-help"
                  value={radiusText}
                  onChange={(e) => setRadiusText(e.target.value)}
                  onBlur={commitRadius}
                />
                <p id="zone-radius-help" className="text-muted-foreground text-xs">
                  {bounds.max === undefined
                    ? bounds.innerEdgeKm > 0
                      ? `Outermost ring — anything past ${fmt(bounds.innerEdgeKm)} km.`
                      : "The only ring — any distance from the shop."
                    : bounds.innerEdgeKm > 0
                      ? `Kept between ${fmt(bounds.innerEdgeKm)} and ${fmt(bounds.max)} km so it can't cross its neighbours.`
                      : `Kept under ${fmt(bounds.max)} km so it can't cross the next ring.`}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="zone-slot">Delivery window</Label>
                <Input
                  id="zone-slot"
                  value={slotWindow}
                  onChange={(e) => setSlotWindow(e.target.value)}
                  placeholder="10:00 AM – 1:00 PM"
                />
              </div>
            )}
          </div>

          {shape === "postal" && (
            <div className="space-y-1.5">
              <Label htmlFor="zone-prefixes">Postal prefixes</Label>
              <Input
                id="zone-prefixes"
                value={prefixText}
                onChange={(e) => setPrefixText(e.target.value)}
                placeholder="M8, M9, L3R"
                aria-describedby="zone-prefixes-help"
              />
              <p id="zone-prefixes-help" className="text-muted-foreground text-xs">
                Comma or space separated. The longest matching prefix wins, so L3R beats L3.
              </p>
            </div>
          )}

          {activeTypes.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Offered delivery types</legend>
              <p className="text-muted-foreground text-xs">None selected = every active type.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeTypes.map((t) => (
                  <label
                    key={t.publicId}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{t.label}</span>
                    <Switch checked={selectedTypes.includes(t.publicId)} onCheckedChange={() => toggleType(t.publicId)} />
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {!isNew ? (
            <Button type="button" variant="outline" disabled={busy || !active} onClick={retire}>
              {active ? "Retire" : "Retired"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" disabled={busy} onClick={save}>
            {pending ? "Saving…" : isNew ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

