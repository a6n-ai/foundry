"use client";

import { useState } from "react";
import type { AddressInput, SavedAddress } from "./rules";

export type AddressBookActions = {
  create(input: AddressInput): Promise<SavedAddress>;
  update(publicId: string, input: AddressInput): Promise<SavedAddress>;
  setDefault(publicId: string): Promise<void>;
  archive(publicId: string): Promise<{ movedToDefault: boolean }>;
};

const sortBook = (list: SavedAddress[]) =>
  [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label));

/** Saved-address list with optimistic default switching; server errors roll back and surface in `error`. */
export function useAddressBook({ initial, actions }: { initial: SavedAddress[]; actions: AddressBookActions }) {
  const [addresses, setAddresses] = useState(() => sortBook(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<void>, rollback?: SavedAddress[]): Promise<boolean> {
    setError(null);
    setPending(true);
    try {
      await work();
      return true;
    } catch (err) {
      if (rollback) setAddresses(rollback);
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    addresses,
    pending,
    error,
    create: (input: AddressInput) =>
      run(async () => {
        const saved = await actions.create(input);
        setAddresses((list) => sortBook([...list.map((a) => (saved.isDefault ? { ...a, isDefault: false } : a)), saved]));
      }),
    update: (publicId: string, input: AddressInput) =>
      run(async () => {
        const saved = await actions.update(publicId, input);
        setAddresses((list) => sortBook(list.map((a) => (a.publicId === publicId ? saved : a))));
      }),
    setDefault: (publicId: string) => {
      const before = addresses;
      setAddresses(sortBook(addresses.map((a) => ({ ...a, isDefault: a.publicId === publicId }))));
      return run(() => actions.setDefault(publicId), before);
    },
    archive: (publicId: string) =>
      run(async () => {
        await actions.archive(publicId);
        setAddresses((list) => list.filter((a) => a.publicId !== publicId));
      }),
  };
}

export type AddressPick = { kind: "saved"; publicId: string } | { kind: "new"; input: AddressInput };

const EMPTY: AddressInput = { addressLine: "", city: "", postalCode: "" };

/** "Use a saved address" vs "add new". Default preselected; no saved addresses → new. */
export function useAddressPicker({ addresses, initial }: { addresses: SavedAddress[]; initial?: string | null }) {
  const firstId = initial ?? addresses.find((a) => a.isDefault)?.publicId ?? addresses[0]?.publicId ?? null;
  const [pick, setPick] = useState<AddressPick>(firstId ? { kind: "saved", publicId: firstId } : { kind: "new", input: EMPTY });
  return {
    pick,
    selected: pick.kind === "saved" ? (addresses.find((a) => a.publicId === pick.publicId) ?? null) : null,
    selectSaved: (publicId: string) => setPick({ kind: "saved", publicId }),
    startNew: () => setPick({ kind: "new", input: EMPTY }),
    setNewInput: (patch: Partial<AddressInput>) =>
      setPick((p) => ({ kind: "new", input: { ...(p.kind === "new" ? p.input : EMPTY), ...patch } })),
  };
}
