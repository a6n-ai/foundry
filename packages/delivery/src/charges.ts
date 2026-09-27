export type DeliveryChargeType = "none" | "fixed" | "percent";

export interface DeliveryChargeItemLike {
  id?: string;
  name: string;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  /** Strategy group the option belongs to ("Drop-off spot"); labels the price line. */
  group?: string | null;
}

export interface DeliveryChargeItemResult {
  id?: string;
  name: string;
  group?: string | null;
  chargeType: DeliveryChargeType;
  chargeValue: number;
  amount: number;
}

export interface DeliveryChargeCalculationResult {
  baseAmount: number;
  /** One per picked strategy option, in the order given. */
  deliveryStrategies: DeliveryChargeItemResult[];
  addressTag?: DeliveryChargeItemResult | null;
  totalDeliveryCharge: number;
  lines: { label: string; amount: number }[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function priceItem(item: DeliveryChargeItemLike, planBasis: number): DeliveryChargeItemResult {
  const chargeValue = Math.max(0, Number(item.chargeValue) || 0);
  const amount =
    item.chargeType === "percent" ? round2(planBasis * (chargeValue / 100))
    : item.chargeType === "fixed" ? round2(chargeValue)
    : 0;
  return { id: item.id, name: item.name, group: item.group ?? null, chargeType: item.chargeType, chargeValue, amount };
}

const percentDetail = (i: DeliveryChargeItemResult) => (i.chargeType === "percent" ? ` (${i.chargeValue}%)` : "");

/**
 * Pure calculation function for delivery charges.
 * Total = Base Charge + every picked strategy option + Address Tag Charge.
 * Percentage charges are computed strictly against planPrice (customer's selected plan price / tiffinSubtotal).
 */
export function calculateDeliveryCharge(params: {
  baseCharge: number;
  deliveryStrategies?: DeliveryChargeItemLike[] | null;
  addressTag?: DeliveryChargeItemLike | null;
  planPrice: number;
}): DeliveryChargeCalculationResult {
  const baseAmount = round2(Math.max(0, params.baseCharge || 0));
  const planBasis = Math.max(0, params.planPrice || 0);
  const deliveryStrategies = (params.deliveryStrategies ?? []).map((s) => priceItem(s, planBasis));
  const addressTag = params.addressTag ? priceItem(params.addressTag, planBasis) : null;

  const lines: { label: string; amount: number }[] = [];
  if (baseAmount > 0) lines.push({ label: "Base delivery charge", amount: baseAmount });
  for (const s of deliveryStrategies) {
    if (s.amount > 0) lines.push({ label: `${s.group ?? "Delivery strategy"}: ${s.name}${percentDetail(s)}`, amount: s.amount });
  }
  if (addressTag && addressTag.amount > 0) {
    lines.push({ label: `Address tag: ${addressTag.name}${percentDetail(addressTag)}`, amount: addressTag.amount });
  }

  const totalDeliveryCharge = round2(
    baseAmount + deliveryStrategies.reduce((sum, s) => sum + s.amount, 0) + (addressTag?.amount ?? 0),
  );
  return { baseAmount, deliveryStrategies, addressTag, totalDeliveryCharge, lines };
}
