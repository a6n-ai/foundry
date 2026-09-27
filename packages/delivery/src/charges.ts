export type DeliveryChargeType = "none" | "fixed" | "percent";
/** A fixed charge applies once per order, or once for every delivery in the plan. */
export type DeliveryChargeBasis = "once" | "per_delivery";
export const DELIVERY_CHARGE_BASES: readonly DeliveryChargeBasis[] = ["once", "per_delivery"];

export interface DeliveryChargeItemLike {
  id?: string;
  name: string;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  /** Tag the strategy sits under ("Drop-off spot"); labels the price line. */
  group?: string | null;
  /** Fixed charges only; absent = once. */
  basis?: DeliveryChargeBasis;
}

export interface DeliveryChargeItemResult {
  id?: string;
  name: string;
  group?: string | null;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  basis: DeliveryChargeBasis;
  /** Deliveries the charge was multiplied by (1 unless per delivery). */
  quantity: number;
  amount: number;
}

export interface DeliveryChargeCalculationResult {
  baseAmount: number;
  /** One per picked strategy (one per tag), in the order given. */
  deliveryStrategies: DeliveryChargeItemResult[];
  addressTag?: DeliveryChargeItemResult | null;
  totalDeliveryCharge: number;
  lines: { label: string; amount: number }[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function priceItem(item: DeliveryChargeItemLike, planBasis: number, deliveryCount: number): DeliveryChargeItemResult {
  const chargeValue = Math.max(0, Number(item.chargeValue) || 0);
  // A percent is already a share of the whole plan, so only a fixed amount can repeat.
  const basis: DeliveryChargeBasis = item.chargeType === "fixed" && item.basis === "per_delivery" ? "per_delivery" : "once";
  const quantity = basis === "per_delivery" ? deliveryCount : 1;
  const amount =
    item.chargeType === "percent" ? round2(planBasis * (chargeValue / 100))
    : item.chargeType === "fixed" ? round2(chargeValue * quantity)
    : 0;
  return { id: item.id, name: item.name, group: item.group ?? null, chargeType: item.chargeType, chargeValue, basis, quantity, amount };
}

const detail = (i: DeliveryChargeItemResult) =>
  i.chargeType === "percent" ? ` (${i.chargeValue}%)`
  : i.basis === "per_delivery" ? ` (${i.quantity} × $${i.chargeValue.toFixed(2)})`
  : "";

/**
 * Pure calculation function for delivery charges.
 * Total = Base Charge + every picked strategy + Address Tag Charge.
 * Percentage charges are computed strictly against planPrice (customer's selected plan price / tiffinSubtotal).
 */
export function calculateDeliveryCharge(params: {
  baseCharge: number;
  deliveryStrategies?: DeliveryChargeItemLike[] | null;
  addressTag?: DeliveryChargeItemLike | null;
  planPrice: number;
  /** Deliveries in the plan, for per-delivery charges. Absent = 1. */
  deliveryCount?: number;
}): DeliveryChargeCalculationResult {
  const baseAmount = round2(Math.max(0, params.baseCharge || 0));
  const planBasis = Math.max(0, params.planPrice || 0);
  const deliveryCount = Math.max(0, Math.trunc(params.deliveryCount ?? 1));
  const deliveryStrategies = (params.deliveryStrategies ?? []).map((s) => priceItem(s, planBasis, deliveryCount));
  const addressTag = params.addressTag ? priceItem(params.addressTag, planBasis, 1) : null;

  const lines: { label: string; amount: number }[] = [];
  if (baseAmount > 0) lines.push({ label: "Base delivery charge", amount: baseAmount });
  for (const s of deliveryStrategies) {
    if (s.amount > 0) lines.push({ label: `${s.group ?? "Delivery strategy"}: ${s.name}${detail(s)}`, amount: s.amount });
  }
  if (addressTag && addressTag.amount > 0) {
    lines.push({ label: `Address tag: ${addressTag.name}${detail(addressTag)}`, amount: addressTag.amount });
  }

  const totalDeliveryCharge = round2(
    baseAmount + deliveryStrategies.reduce((sum, s) => sum + s.amount, 0) + (addressTag?.amount ?? 0),
  );
  return { baseAmount, deliveryStrategies, addressTag, totalDeliveryCharge, lines };
}
