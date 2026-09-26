import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import type { PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { ValidationError } from "@foundry/commons";
import type { Database } from "@foundry/database";
import {
  defaultLabel,
  locationChanged,
  normalizeAddressInput,
  toSnapshot,
  type AddressInput,
  type AddressSnapshot,
  type SavedAddress,
} from "./rules";
import type { AddressTables, CustomerAddressRow } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AddressTx = PostgresJsTransaction<any, any>;

export type AuditEntry = {
  entity: string;
  entityPublicId: string;
  operation: "create" | "update" | "delete";
  changes: Record<string, unknown>;
};

export type AddressHooks = {
  /** After an address's fields change, inside the same tx. Throw to refuse the edit. */
  onUpdated?(a: { addressId: bigint; before: AddressSnapshot; after: AddressSnapshot }, tx: AddressTx): Promise<void>;
  /** Before an address is archived, inside the same tx: move editable users to the default. */
  onArchived?(
    a: { addressId: bigint; defaultAddressId: bigint | null; defaultSnapshot: AddressSnapshot | null },
    tx: AddressTx,
  ): Promise<void>;
  /** Anything still editable points at it — blocks archiving the only address. */
  isInUse?(addressId: bigint, tx: AddressTx): Promise<boolean>;
};

export type AddressScope = { userId: bigint; orgId?: string | null };

export type AddressServiceDeps = {
  db: Database;
  tables: AddressTables;
  /** Stored coordinates — pass an AWS-only resolver (resolveAndPersist). Failure never blocks a save. */
  geocode?: (address: string) => Promise<{ lat: number; lng: number } | null>;
  currentUserId?: () => Promise<bigint | null>;
  audit?: (e: AuditEntry) => Promise<void>;
  hooks?: AddressHooks;
};

export function toSavedAddress(r: CustomerAddressRow): SavedAddress {
  return {
    publicId: r.publicId,
    label: r.label,
    fullName: r.fullName,
    addressLine: r.addressLine,
    addressUnit: r.addressUnit,
    city: r.city,
    province: r.province,
    postalCode: r.postalCode,
    deliveryInstructions: r.deliveryInstructions,
    isDefault: r.isDefault,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
  };
}

export function createAddressService(deps: AddressServiceDeps) {
  const { db, hooks = {} } = deps;
  const t = deps.tables.customerAddresses;
  const actor = async () => (deps.currentUserId ? await deps.currentUserId() : null);
  const audit = async (e: AuditEntry) => {
    if (deps.audit) await deps.audit(e);
  };
  const owned = (scope: AddressScope) =>
    and(eq(t.userId, scope.userId), isNull(t.archivedAt), scope.orgId ? eq(t.organizationId, scope.orgId) : undefined);
  const geocode = async (s: AddressSnapshot) => {
    if (!deps.geocode) return null;
    return deps.geocode([s.addressLine, s.city, s.postalCode].join(", ")).catch(() => null);
  };
  const coords = (p: { lat: number; lng: number } | null) =>
    p ? { lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) } : { lat: null, lng: null };

  async function liveLabels(scope: AddressScope, tx: AddressTx | Database, exceptId?: bigint) {
    const rows = await tx
      .select({ label: t.label })
      .from(t)
      .where(and(owned(scope), exceptId ? ne(t.id, exceptId) : undefined));
    return rows.map((r) => r.label);
  }

  async function getRow(scope: AddressScope, publicId: string, tx: AddressTx | Database = db): Promise<CustomerAddressRow> {
    const [row] = await tx.select().from(t).where(and(owned(scope), eq(t.publicId, publicId))).limit(1);
    if (!row) throw new ValidationError("Address not found");
    return row;
  }

  async function assertLabelFree(scope: AddressScope, label: string, tx: AddressTx, exceptId?: bigint) {
    const taken = (await liveLabels(scope, tx, exceptId)).some((l) => l.toLowerCase() === label.toLowerCase());
    if (taken) throw new ValidationError(`You already have an address called "${label}"`);
  }

  async function create(
    scope: AddressScope,
    input: AddressInput,
    opts: { makeDefault?: boolean; tx?: AddressTx } = {},
  ): Promise<SavedAddress & { id: bigint }> {
    const v = normalizeAddressInput(input);
    const point = await geocode(v);
    const by = await actor();
    const run = async (tx: AddressTx) => {
      const labels = await liveLabels(scope, tx);
      const isFirst = labels.length === 0;
      const label = v.label ?? defaultLabel(v, labels, isFirst);
      if (v.label) await assertLabelFree(scope, label, tx);
      const makeDefault = isFirst || opts.makeDefault === true;
      if (makeDefault) {
        await tx
          .update(t)
          .set({ isDefault: false, updatedAt: Date.now(), updatedBy: by })
          .where(and(owned(scope), eq(t.isDefault, true)));
      }
      const [row] = await tx
        .insert(t)
        .values({
          ...v,
          label,
          ...coords(point),
          userId: scope.userId,
          organizationId: scope.orgId ?? null,
          isDefault: makeDefault,
          createdBy: by,
          updatedBy: by,
        })
        .returning();
      return row!;
    };
    const row = opts.tx ? await run(opts.tx) : await db.transaction(run);
    await audit({ entity: "customer_addresses", entityPublicId: row.publicId, operation: "create", changes: { ...v, label: row.label } });
    return { ...toSavedAddress(row), id: row.id };
  }

  return {
    getRow,
    create,

    async list(scope: AddressScope): Promise<SavedAddress[]> {
      const rows = await db.select().from(t).where(owned(scope)).orderBy(desc(t.isDefault), asc(t.label));
      return rows.map(toSavedAddress);
    },

    async update(scope: AddressScope, publicId: string, input: AddressInput): Promise<SavedAddress> {
      const v = normalizeAddressInput(input);
      const by = await actor();
      const row = await db.transaction(async (tx) => {
        const before = await getRow(scope, publicId, tx);
        const label = v.label ?? before.label;
        if (label.toLowerCase() !== before.label.toLowerCase()) await assertLabelFree(scope, label, tx, before.id);
        const beforeSnap = toSnapshot(before);
        const afterSnap = toSnapshot(v);
        const moved = locationChanged(beforeSnap, afterSnap);
        const point = moved ? await geocode(afterSnap) : null;
        const [updated] = await tx
          .update(t)
          .set({ ...v, label, ...(moved ? coords(point) : {}), updatedAt: Date.now(), updatedBy: by })
          .where(eq(t.id, before.id))
          .returning();
        await hooks.onUpdated?.({ addressId: before.id, before: beforeSnap, after: afterSnap }, tx);
        return updated!;
      });
      await audit({ entity: "customer_addresses", entityPublicId: publicId, operation: "update", changes: { ...v } });
      return toSavedAddress(row);
    },

    async setDefault(scope: AddressScope, publicId: string): Promise<void> {
      const by = await actor();
      await db.transaction(async (tx) => {
        const row = await getRow(scope, publicId, tx);
        if (row.isDefault) return;
        await tx
          .update(t)
          .set({ isDefault: false, updatedAt: Date.now(), updatedBy: by })
          .where(and(owned(scope), eq(t.isDefault, true)));
        await tx.update(t).set({ isDefault: true, updatedAt: Date.now(), updatedBy: by }).where(eq(t.id, row.id));
      });
      await audit({ entity: "customer_addresses", entityPublicId: publicId, operation: "update", changes: { isDefault: true } });
    },

    async archive(scope: AddressScope, publicId: string): Promise<{ movedToDefault: boolean }> {
      const by = await actor();
      const result = await db.transaction(async (tx) => {
        const row = await getRow(scope, publicId, tx);
        if (row.isDefault) {
          const others = await liveLabels(scope, tx, row.id);
          if (others.length > 0) throw new ValidationError("Make another address the default first");
          if (await hooks.isInUse?.(row.id, tx)) {
            throw new ValidationError("Upcoming deliveries still use this address — add another address first");
          }
        } else {
          const [def] = await tx.select().from(t).where(and(owned(scope), eq(t.isDefault, true))).limit(1);
          await hooks.onArchived?.(
            { addressId: row.id, defaultAddressId: def?.id ?? null, defaultSnapshot: def ? toSnapshot(def) : null },
            tx,
          );
        }
        await tx
          .update(t)
          .set({ archivedAt: Date.now(), isDefault: false, updatedAt: Date.now(), updatedBy: by })
          .where(eq(t.id, row.id));
        return { movedToDefault: !row.isDefault };
      });
      await audit({ entity: "customer_addresses", entityPublicId: publicId, operation: "delete", changes: {} });
      return result;
    },
  };
}

export type AddressService = ReturnType<typeof createAddressService>;
