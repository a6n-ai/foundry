"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { AddressValues } from "@foundry/commons";
import { SectionCard } from "@foundry/design-system";
import { AddressFields } from "@foundry/ui/address-fields";
import { Button } from "@foundry/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@foundry/ui/dialog";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { useAddressBook, type AddressBookActions } from "../hooks";
import type { AddressInput, SavedAddress } from "../rules";
import { AddressCard } from "./address-card";

type Editing = { publicId: string | null; label: string; values: AddressValues } | null;

const toValues = (a: SavedAddress): AddressValues => ({
  fullName: a.fullName ?? "",
  addressLine: a.addressLine,
  addressUnit: a.addressUnit ?? "",
  city: a.city,
  postalCode: a.postalCode,
  deliveryInstructions: a.deliveryInstructions ?? "",
});

const toInput = (label: string, v: AddressValues): AddressInput => ({
  label: label || null,
  fullName: v.fullName,
  addressLine: v.addressLine ?? "",
  addressUnit: v.addressUnit,
  city: v.city ?? "",
  postalCode: v.postalCode ?? "",
  deliveryInstructions: v.deliveryInstructions,
});

/** Staff view of one customer's saved addresses (admin customer page). */
export function CustomerAddressesCard({
  initial,
  actions,
  title = "Addresses",
}: {
  initial: SavedAddress[];
  actions: AddressBookActions;
  title?: string;
}) {
  const book = useAddressBook({ initial, actions });
  const [editing, setEditing] = useState<Editing>(null);
  const defaultLabel = book.addresses.find((a) => a.isDefault)?.label ?? "the default";

  async function save() {
    if (!editing) return;
    const input = toInput(editing.label, editing.values);
    const ok = editing.publicId ? await book.update(editing.publicId, input) : await book.create(input);
    if (ok) {
      toast.success("Address saved");
      setEditing(null);
    }
  }

  async function run(p: Promise<boolean>, message: string) {
    if (await p) toast.success(message);
  }

  return (
    <SectionCard title={title}>
      <div className="space-y-2">
        {book.addresses.length === 0 && <p className="text-muted-foreground text-sm">No saved addresses.</p>}
        {book.addresses.map((a) => (
          <AddressCard
            key={a.publicId}
            address={a}
            actions={
              <div className="flex shrink-0 gap-1">
                {!a.isDefault && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Make ${a.label} default`}
                    onClick={() => run(book.setDefault(a.publicId), `${a.label} is now the default`)}
                  >
                    <StarIcon className="size-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${a.label}`}
                  onClick={() => setEditing({ publicId: a.publicId, label: a.label, values: toValues(a) })}
                >
                  <PencilIcon className="size-4" />
                </Button>
                {!a.isDefault && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${a.label}`}
                    onClick={() => run(book.archive(a.publicId), `${a.label} deleted — upcoming deliveries moved to ${defaultLabel}`)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                )}
              </div>
            }
          />
        ))}
        {book.error && <p className="text-destructive text-sm">{book.error}</p>}
        <Button variant="outline" size="sm" onClick={() => setEditing({ publicId: null, label: "", values: {} })}>
          <PlusIcon /> Add address
        </Button>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.publicId ? "Edit address" : "Add address"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="address-label">Label</Label>
                <Input
                  id="address-label"
                  value={editing.label}
                  placeholder="Home, Work…"
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <AddressFields
                preset="delivery"
                idPrefix="staff-address"
                values={editing.values}
                onChange={(patch) => setEditing({ ...editing, values: { ...editing.values, ...patch } })}
              />
            </div>
          )}
          <DialogFooter>
            <Button disabled={book.pending} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
