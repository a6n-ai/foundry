"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DeliveryTypeInput, ZoneInput } from "../service";

/** Shared row shapes for the admin screens — the app's page maps service results into these. */
export type ZoneRow = {
  publicId: string;
  name: string;
  /** Circle zone radius; null = postal zone. */
  radiusKm: number | null;
  postalPrefixes: string[];
  slotWindow: string | null;
  active: boolean;
  typePublicIds: string[];
};

export type TypeOption = { publicId: string; key: string; label: string; active: boolean };

type Result = { error?: string };

/** The app's server actions. Auth, org scoping and revalidation stay in the app. */
export interface DeliveryAdminActions {
  saveZone: (input: ZoneInput) => Promise<Result & { radiusKm?: number | null; publicId?: string }>;
  retireZone: (publicId: string) => Promise<Result>;
  setZoneTypes: (zonePublicId: string, typePublicIds: string[]) => Promise<Result>;
  saveStoreOrigin: (lat: number, lng: number) => Promise<Result>;
  /** Geocodes on the server so the client never asserts its own coordinates. */
  saveStoreOriginFromAddress: (input: { placeId?: string; address: string }) => Promise<
    Result & { lat?: number; lng?: number; formattedAddress?: string }
  >;
  saveType: (input: DeliveryTypeInput) => Promise<Result>;
  retireType: (publicId: string) => Promise<Result>;
}

/** Slot for the app's address search input (e.g. a Places autocomplete). Defaults to a plain input. */
export type AddressInputSlot = (props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (pick: { address: string; placeId?: string }) => void;
}) => ReactNode;

const Ctx = createContext<DeliveryAdminActions | null>(null);

export function DeliveryAdminProvider({ actions, children }: { actions: DeliveryAdminActions; children: ReactNode }) {
  return <Ctx.Provider value={actions}>{children}</Ctx.Provider>;
}

export function useDeliveryActions(): DeliveryAdminActions {
  const actions = useContext(Ctx);
  if (!actions) throw new Error("Delivery admin components must render inside <DeliveryAdminProvider>");
  return actions;
}
