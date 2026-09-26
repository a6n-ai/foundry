import { and, asc, eq, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { ValidationError } from "@foundry/commons";
import type { Database } from "@foundry/database";
import type { DeliveryChargeType } from "./charges";
import type { DeliveryTables } from "./schema";
import { clampRadiusKm, normalizePostal, type DeliveryType, type ZoneWithTypes } from "./zones";

export type DeliveryChargeRuleDto = {
  id: string; // publicId
  internalId: bigint;
  name: string;
  description: string | null;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  active: boolean;
  sortOrder: number;
};

export type DeliveryChargeRuleInput = {
  id?: string; // publicId when updating
  name: string;
  description?: string | null;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  active?: boolean;
};

export type DeleteRuleResult = { success: boolean; deactivatedInstead?: boolean };

export type ZoneInput = {
  publicId?: string | null;
  name: string;
  /** Exactly one of radiusKm / postalPrefixes. */
  radiusKm?: number | null;
  postalPrefixes?: string[];
  slotWindow?: string | null;
  active: boolean;
};

export type DeliveryTypeInput = {
  publicId?: string | null;
  /** Set once at creation; ignored on update. */
  key: string;
  label: string;
  description?: string | null;
  requiresAddress: boolean;
  requiresSchedule: boolean;
  minSubtotal: number;
  discountPct: number;
  sortOrder: number;
  active: boolean;
};

export type AuditEntry = {
  entity: string;
  entityPublicId: string;
  operation: "create" | "update" | "delete";
  changes: Record<string, unknown>;
};

export type DeliveryServiceDeps = {
  db: Database;
  tables: DeliveryTables;
  /** Whether an app-owned row (order, user…) still points at this rule. In use = deactivate, not delete. */
  isStrategyInUse: (id: bigint) => Promise<boolean>;
  isAddressTagInUse: (id: bigint) => Promise<boolean>;
  /** Session user for created_by/updated_by. Never taken from input. */
  currentUserId?: () => Promise<bigint | null>;
  /** Optional audit sink, called after each write. */
  audit?: (entry: AuditEntry) => Promise<void>;
};

type ListOptions = { includeInactive?: boolean; orgId?: string | null };

const CHARGE_TYPES: readonly DeliveryChargeType[] = ["none", "fixed", "percent"];
const TYPE_KEY = /^[a-z][a-z0-9_]*$/;

/** Rows visible to an org: its own plus shared (null) ones. No org = everything. */
export function orgScope(column: AnyPgColumn, orgId?: string | null): SQL | undefined {
  return orgId ? or(eq(column, orgId), isNull(column)) : undefined;
}

export function createDeliveryService(deps: DeliveryServiceDeps) {
  const { db, tables } = deps;
  const { deliveryZones: zones, deliveryTypes: types, deliveryZoneTypes: zoneTypes, deliveryChargeConfigs: configs } = tables;
  const actor = async () => (deps.currentUserId ? await deps.currentUserId() : null);
  const audit = async (entry: AuditEntry) => {
    if (deps.audit) await deps.audit(entry);
  };
  const configFor = (orgId?: string | null) => (orgId ? eq(configs.organizationId, orgId) : isNull(configs.organizationId));

  type RuleTable = DeliveryTables["deliveryStrategies"];

  function ruleService(table: RuleTable, entity: string, label: string, isInUse: (id: bigint) => Promise<boolean>) {
    const toDto = (r: RuleTable["$inferSelect"]): DeliveryChargeRuleDto => ({
      id: r.publicId,
      internalId: r.id,
      name: r.name,
      description: r.description,
      chargeType: r.chargeType,
      chargeValue: Number(r.chargeValue),
      active: r.active,
      sortOrder: r.sortOrder,
    });
    const owned = (publicId: string, orgId?: string | null) => and(eq(table.publicId, publicId), orgScope(table.organizationId, orgId));

    return {
      async list(options?: ListOptions): Promise<DeliveryChargeRuleDto[]> {
        const rows = await db
          .select()
          .from(table)
          .where(and(options?.includeInactive ? undefined : eq(table.active, true), orgScope(table.organizationId, options?.orgId)))
          .orderBy(asc(table.sortOrder), asc(table.name));
        return rows.map(toDto);
      },

      async save(input: DeliveryChargeRuleInput, orgId?: string | null): Promise<DeliveryChargeRuleDto> {
        const name = input.name.trim();
        if (!name) throw new ValidationError(`${label} name is required`);
        if (!CHARGE_TYPES.includes(input.chargeType)) throw new ValidationError("Invalid charge type");
        const chargeValue = input.chargeType === "none" ? 0 : Number(input.chargeValue);
        if (!Number.isFinite(chargeValue) || chargeValue < 0) throw new ValidationError("Charge value cannot be negative");
        if (input.chargeType === "percent" && chargeValue > 100) {
          throw new ValidationError("Percentage charge cannot exceed 100%");
        }

        const [duplicate] = await db
          .select({ id: table.id })
          .from(table)
          .where(input.id ? and(eq(table.name, name), ne(table.publicId, input.id)) : eq(table.name, name))
          .limit(1);
        if (duplicate) throw new ValidationError(`A ${label.toLowerCase()} with that name already exists`);

        const values = {
          name,
          description: input.description?.trim() || null,
          chargeType: input.chargeType,
          chargeValue: chargeValue.toFixed(2),
          active: input.active ?? true,
        };
        const by = await actor();

        if (input.id) {
          const [updated] = await db
            .update(table)
            .set({ ...values, updatedAt: Date.now(), updatedBy: by })
            .where(owned(input.id, orgId))
            .returning();
          if (!updated) throw new ValidationError(`${label} not found`);
          await audit({ entity, entityPublicId: updated.publicId, operation: "update", changes: values });
          return toDto(updated);
        }
        const [created] = await db
          .insert(table)
          .values({ ...values, organizationId: orgId ?? null, createdBy: by, updatedBy: by })
          .returning();
        await audit({ entity, entityPublicId: created!.publicId, operation: "create", changes: values });
        return toDto(created!);
      },

      async remove(publicId: string, orgId?: string | null): Promise<DeleteRuleResult> {
        const [row] = await db.select({ id: table.id }).from(table).where(owned(publicId, orgId)).limit(1);
        if (!row) throw new ValidationError(`${label} not found`);

        if (await isInUse(row.id)) {
          await db.update(table).set({ active: false, updatedAt: Date.now(), updatedBy: await actor() }).where(eq(table.id, row.id));
          await audit({ entity, entityPublicId: publicId, operation: "update", changes: { active: false } });
          return { success: true, deactivatedInstead: true };
        }
        await db.delete(table).where(eq(table.id, row.id));
        await audit({ entity, entityPublicId: publicId, operation: "delete", changes: {} });
        return { success: true, deactivatedInstead: false };
      },
    };
  }

  // Strategies and tags have identical columns (ruleColumns in schema.ts); only the SQL name differs.
  const strategies = ruleService(tables.deliveryStrategies, "delivery_strategies", "Delivery strategy", deps.isStrategyInUse);
  const tags = ruleService(tables.addressTags as unknown as RuleTable, "address_tags", "Address tag", deps.isAddressTagInUse);

  const toType = (r: typeof types.$inferSelect): DeliveryType => ({
    id: r.id,
    publicId: r.publicId,
    key: r.key,
    label: r.label,
    description: r.description,
    requiresAddress: r.requiresAddress,
    requiresSchedule: r.requiresSchedule,
    minSubtotal: Number(r.minSubtotal),
    discountPct: Number(r.discountPct),
    sortOrder: r.sortOrder,
    active: r.active,
  });

  async function listZones(options?: ListOptions): Promise<ZoneWithTypes[]> {
    // One query (zones ⟕ zone_types ⟕ types) grouped in JS — never N+1 per zone.
    const rows = await db
      .select({ zone: zones, type: types })
      .from(zones)
      .leftJoin(zoneTypes, eq(zoneTypes.zoneId, zones.id))
      .leftJoin(types, eq(types.id, zoneTypes.typeId))
      .where(and(options?.includeInactive ? undefined : eq(zones.active, true), orgScope(zones.organizationId, options?.orgId)))
      .orderBy(asc(zones.name));
    const byId = new Map<bigint, ZoneWithTypes>();
    for (const { zone, type } of rows) {
      let entry = byId.get(zone.id);
      if (!entry) {
        entry = {
          id: zone.id,
          publicId: zone.publicId,
          name: zone.name,
          radiusKm: zone.radiusKm == null ? null : Number(zone.radiusKm),
          postalPrefixes: zone.postalPrefixes,
          slotWindow: zone.slotWindow,
          active: zone.active,
          types: [],
        };
        byId.set(zone.id, entry);
      }
      if (type) entry.types.push(toType(type));
    }
    return [...byId.values()];
  }

  return {
    // ── Charges ──────────────────────────────────────────────────────────────
    async getBaseDeliveryCharge(orgId?: string | null): Promise<number> {
      const [row] = await db.select({ baseCharge: configs.baseCharge }).from(configs).where(configFor(orgId)).limit(1);
      return row ? Number(row.baseCharge) : 0;
    },

    async updateBaseDeliveryCharge(baseCharge: number, orgId?: string | null): Promise<number> {
      if (!Number.isFinite(baseCharge) || baseCharge < 0) throw new ValidationError("Base delivery charge cannot be negative");
      const val = baseCharge.toFixed(2);
      await upsertConfig(orgId, { baseCharge: val });
      return Number(val);
    },

    listDeliveryStrategies: strategies.list,
    saveDeliveryStrategy: strategies.save,
    deleteDeliveryStrategy: strategies.remove,
    listAddressTags: tags.list,
    saveAddressTag: tags.save,
    deleteAddressTag: tags.remove,

    // ── Store origin (centre of circle zones) ────────────────────────────────
    async getStoreOrigin(orgId?: string | null): Promise<{ lat: number; lng: number } | null> {
      const [row] = await db
        .select({ lat: configs.storeLat, lng: configs.storeLng })
        .from(configs)
        .where(configFor(orgId))
        .limit(1);
      return row?.lat != null && row.lng != null ? { lat: Number(row.lat), lng: Number(row.lng) } : null;
    },

    async saveStoreOrigin(lat: number, lng: number, orgId?: string | null): Promise<void> {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new ValidationError("Invalid coordinates");
      }
      await upsertConfig(orgId, { storeLat: lat.toFixed(6), storeLng: lng.toFixed(6) });
    },

    // ── Zones ────────────────────────────────────────────────────────────────
    listZones,

    async saveZone(input: ZoneInput, orgId?: string | null): Promise<ZoneWithTypes> {
      const name = input.name.trim();
      if (!name) throw new ValidationError("Zone name is required");
      const prefixes = [...new Set((input.postalPrefixes ?? []).map(normalizePostal).filter(Boolean))];
      const isCircle = input.radiusKm != null;
      if (isCircle === prefixes.length > 0) {
        throw new ValidationError("A zone is either a radius circle or a list of postal prefixes");
      }
      let radiusKm: number | null = null;
      if (isCircle) {
        if (!Number.isFinite(input.radiusKm) || (input.radiusKm as number) <= 0) {
          throw new ValidationError("Radius must be greater than 0");
        }
        // Authoritative ring enforcement — the map mirrors it client-side, but a crafted
        // request still can't cross or overlap a neighbouring circle.
        radiusKm = input.active
          ? clampRadiusKm(input.radiusKm as number, await listZones({ orgId }), input.publicId ?? null)
          : (input.radiusKm as number);
      }
      const values = {
        name,
        radiusKm: radiusKm == null ? null : radiusKm.toFixed(2),
        postalPrefixes: prefixes,
        slotWindow: input.slotWindow?.trim() || null,
        active: input.active,
      };
      const by = await actor();
      const [row] = input.publicId
        ? await db
            .update(zones)
            .set({ ...values, updatedAt: Date.now(), updatedBy: by })
            .where(and(eq(zones.publicId, input.publicId), orgScope(zones.organizationId, orgId)))
            .returning()
        : await db.insert(zones).values({ ...values, organizationId: orgId ?? null, createdBy: by, updatedBy: by }).returning();
      if (!row) throw new ValidationError("Zone not found");
      await audit({ entity: "delivery_zones", entityPublicId: row.publicId, operation: input.publicId ? "update" : "create", changes: values });
      return {
        id: row.id,
        publicId: row.publicId,
        name: row.name,
        radiusKm,
        postalPrefixes: row.postalPrefixes,
        slotWindow: row.slotWindow,
        active: row.active,
        types: [],
      };
    },

    async retireZone(publicId: string, orgId?: string | null): Promise<void> {
      const [row] = await db
        .update(zones)
        .set({ active: false, updatedAt: Date.now(), updatedBy: await actor() })
        .where(and(eq(zones.publicId, publicId), orgScope(zones.organizationId, orgId)))
        .returning({ id: zones.id });
      if (!row) throw new ValidationError("Zone not found");
      await audit({ entity: "delivery_zones", entityPublicId: publicId, operation: "update", changes: { active: false } });
    },

    /** Replaces a zone's offered types wholesale — the admin's checkbox state is authoritative. */
    async setZoneTypes(zonePublicId: string, typePublicIds: string[], orgId?: string | null): Promise<void> {
      const [zone] = await db
        .select({ id: zones.id })
        .from(zones)
        .where(and(eq(zones.publicId, zonePublicId), orgScope(zones.organizationId, orgId)))
        .limit(1);
      if (!zone) throw new ValidationError("Zone not found");
      const typeRows = typePublicIds.length
        ? await db
            .select({ id: types.id })
            .from(types)
            .where(and(inArray(types.publicId, typePublicIds), orgScope(types.organizationId, orgId)))
        : [];
      if (typeRows.length !== new Set(typePublicIds).size) throw new ValidationError("Unknown delivery type");
      const by = await actor();
      await db.transaction(async (tx) => {
        await tx.delete(zoneTypes).where(eq(zoneTypes.zoneId, zone.id));
        if (typeRows.length) {
          await tx.insert(zoneTypes).values(typeRows.map((t) => ({ zoneId: zone.id, typeId: t.id, createdBy: by, updatedBy: by })));
        }
      });
      await audit({ entity: "delivery_zone_types", entityPublicId: zonePublicId, operation: "update", changes: { typePublicIds } });
    },

    // ── Types ────────────────────────────────────────────────────────────────
    async listTypes(options?: ListOptions): Promise<DeliveryType[]> {
      const rows = await db
        .select()
        .from(types)
        .where(and(options?.includeInactive ? undefined : eq(types.active, true), orgScope(types.organizationId, options?.orgId)))
        .orderBy(asc(types.sortOrder));
      return rows.map(toType);
    },

    async saveType(input: DeliveryTypeInput, orgId?: string | null): Promise<DeliveryType> {
      const label = input.label.trim();
      if (!label) throw new ValidationError("Label is required");
      if (!(input.minSubtotal >= 0)) throw new ValidationError("Minimum subtotal must be 0 or more");
      if (!(input.discountPct >= 0 && input.discountPct <= 100)) throw new ValidationError("Discount must be between 0 and 100");
      const values = {
        label,
        description: input.description?.trim() || null,
        requiresAddress: input.requiresAddress,
        requiresSchedule: input.requiresSchedule,
        minSubtotal: input.minSubtotal.toFixed(2),
        discountPct: input.discountPct.toFixed(2),
        sortOrder: Math.trunc(input.sortOrder),
        active: input.active,
      };
      const by = await actor();
      if (input.publicId) {
        // key is immutable after creation — a resubmitted edit form never patches it.
        const [row] = await db
          .update(types)
          .set({ ...values, updatedAt: Date.now(), updatedBy: by })
          .where(and(eq(types.publicId, input.publicId), orgScope(types.organizationId, orgId)))
          .returning();
        if (!row) throw new ValidationError("Delivery type not found");
        await audit({ entity: "delivery_types", entityPublicId: row.publicId, operation: "update", changes: values });
        return toType(row);
      }
      if (!TYPE_KEY.test(input.key)) throw new ValidationError("Key: lowercase letters, digits, underscores; starts with a letter");
      const [taken] = await db.select({ id: types.id }).from(types).where(eq(types.key, input.key)).limit(1);
      if (taken) throw new ValidationError(`Key "${input.key}" is already in use`);
      const [row] = await db
        .insert(types)
        .values({ ...values, key: input.key, organizationId: orgId ?? null, createdBy: by, updatedBy: by })
        .returning();
      await audit({ entity: "delivery_types", entityPublicId: row!.publicId, operation: "create", changes: { ...values, key: input.key } });
      return toType(row!);
    },

    async retireType(publicId: string, orgId?: string | null): Promise<void> {
      const [row] = await db
        .update(types)
        .set({ active: false, updatedAt: Date.now(), updatedBy: await actor() })
        .where(and(eq(types.publicId, publicId), orgScope(types.organizationId, orgId)))
        .returning({ id: types.id });
      if (!row) throw new ValidationError("Delivery type not found");
      await audit({ entity: "delivery_types", entityPublicId: publicId, operation: "update", changes: { active: false } });
    },

    /** Type/zone labels for an order — resolves the FK ids the order row carries. */
    async labelsForOrder(typeId: bigint | null, zoneId: bigint | null): Promise<{ typeLabel: string | null; zoneName: string | null }> {
      const [t] = typeId ? await db.select({ label: types.label }).from(types).where(eq(types.id, typeId)).limit(1) : [];
      const [z] = zoneId ? await db.select({ name: zones.name }).from(zones).where(eq(zones.id, zoneId)).limit(1) : [];
      return { typeLabel: t?.label ?? null, zoneName: z?.name ?? null };
    },
  };

  async function upsertConfig(orgId: string | null | undefined, patch: Partial<typeof configs.$inferInsert>) {
    const by = await actor();
    const [existing] = await db.select({ id: configs.id }).from(configs).where(configFor(orgId)).limit(1);
    if (existing) {
      await db.update(configs).set({ ...patch, updatedAt: Date.now(), updatedBy: by }).where(eq(configs.id, existing.id));
    } else {
      await db.insert(configs).values({ ...patch, organizationId: orgId ?? null, createdBy: by, updatedBy: by });
    }
  }
}

export type DeliveryService = ReturnType<typeof createDeliveryService>;
