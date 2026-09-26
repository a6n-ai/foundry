import { and, asc, eq, isNull, ne, or } from "drizzle-orm";
import { ValidationError } from "@foundry/commons";
import type { Database } from "@foundry/database";
import type { DeliveryChargeType } from "./charges";
import type { DeliveryChargeTables } from "./schema";

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

export type DeliveryChargesDeps = {
  db: Database;
  tables: DeliveryChargeTables;
  /**
   * Whether an app-owned row (order, user…) still points at this rule. A rule in
   * use is deactivated instead of deleted so history keeps its name.
   */
  isStrategyInUse: (id: bigint) => Promise<boolean>;
  isAddressTagInUse: (id: bigint) => Promise<boolean>;
};

const CHARGE_TYPES: readonly DeliveryChargeType[] = ["none", "fixed", "percent"];

type RuleTable = DeliveryChargeTables["deliveryStrategies"];

function makeRuleService(db: Database, table: RuleTable, label: string, isInUse: (id: bigint) => Promise<boolean>) {
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

  return {
    async list(options?: { includeInactive?: boolean; orgId?: string | null }): Promise<DeliveryChargeRuleDto[]> {
      const conditions = [];
      if (!options?.includeInactive) conditions.push(eq(table.active, true));
      if (options?.orgId) conditions.push(or(eq(table.organizationId, options.orgId), isNull(table.organizationId)));
      const rows = await db
        .select()
        .from(table)
        .where(conditions.length ? and(...conditions) : undefined)
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

      if (input.id) {
        const [updated] = await db
          .update(table)
          .set({ ...values, updatedAt: Date.now() })
          .where(eq(table.publicId, input.id))
          .returning();
        if (!updated) throw new ValidationError(`${label} not found`);
        return toDto(updated);
      }

      const [created] = await db
        .insert(table)
        .values({ ...values, organizationId: orgId ?? null })
        .returning();
      return toDto(created!);
    },

    async remove(publicId: string): Promise<DeleteRuleResult> {
      const [row] = await db.select({ id: table.id }).from(table).where(eq(table.publicId, publicId)).limit(1);
      if (!row) throw new ValidationError(`${label} not found`);

      if (await isInUse(row.id)) {
        await db.update(table).set({ active: false, updatedAt: Date.now() }).where(eq(table.id, row.id));
        return { success: true, deactivatedInstead: true };
      }
      await db.delete(table).where(eq(table.id, row.id));
      return { success: true, deactivatedInstead: false };
    },
  };
}

export function createDeliveryChargesService(deps: DeliveryChargesDeps) {
  const { db, tables } = deps;
  const configs = tables.deliveryChargeConfigs;
  const orgScope = (orgId?: string | null) => (orgId ? eq(configs.organizationId, orgId) : isNull(configs.organizationId));

  // Both tables have identical columns (see ruleColumns in schema.ts); only the SQL name differs.
  const strategies = makeRuleService(db, tables.deliveryStrategies, "Delivery type", deps.isStrategyInUse);
  const tags = makeRuleService(db, tables.addressTags as unknown as RuleTable, "Address tag", deps.isAddressTagInUse);

  return {
    async getBaseDeliveryCharge(orgId?: string | null): Promise<number> {
      const [row] = await db.select({ baseCharge: configs.baseCharge }).from(configs).where(orgScope(orgId)).limit(1);
      return row ? Number(row.baseCharge) : 0;
    },

    async updateBaseDeliveryCharge(baseCharge: number, orgId?: string | null): Promise<number> {
      if (!Number.isFinite(baseCharge) || baseCharge < 0) {
        throw new ValidationError("Base delivery charge cannot be negative");
      }
      const val = baseCharge.toFixed(2);
      const [existing] = await db.select({ id: configs.id }).from(configs).where(orgScope(orgId)).limit(1);
      if (existing) {
        await db.update(configs).set({ baseCharge: val, updatedAt: Date.now() }).where(eq(configs.id, existing.id));
      } else {
        await db.insert(configs).values({ baseCharge: val, organizationId: orgId ?? null });
      }
      return Number(val);
    },

    listDeliveryStrategies: strategies.list,
    saveDeliveryStrategy: strategies.save,
    deleteDeliveryStrategy: strategies.remove,
    listAddressTags: tags.list,
    saveAddressTag: tags.save,
    deleteAddressTag: tags.remove,
  };
}

export type DeliveryChargesService = ReturnType<typeof createDeliveryChargesService>;
