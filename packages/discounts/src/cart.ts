import { resolveCoupons, type CouponCandidate, type CouponResolution } from "@foundry/coupons";
import { resolveCatalogDiscounts, round2, type CatalogResolution, type DiscountRule } from "./engine";

export type CartResolution = {
  catalog: CatalogResolution;
  coupons: CouponResolution;
  subtotalAfterCatalog: number;
  totalOff: number;
  finalSubtotal: number;
};

export function resolveCart(input: {
  subtotal: number;
  rules: DiscountRule[];
  maxDiscountPct: number;
  coupons: CouponCandidate[];
  couponCtx: { now: number; paymentMethod?: string | null };
}): CartResolution {
  const catalog = resolveCatalogDiscounts(input.rules, {
    subtotal: input.subtotal,
    maxDiscountPct: input.maxDiscountPct,
  });
  const subtotalAfterCatalog = round2(Math.max(0, input.subtotal - catalog.totalAmount));
  const coupons = resolveCoupons(input.coupons, { ...input.couponCtx, subtotal: subtotalAfterCatalog });
  const totalOff = round2(Math.min(input.subtotal, catalog.totalAmount + coupons.total));
  return { catalog, coupons, subtotalAfterCatalog, totalOff, finalSubtotal: round2(input.subtotal - totalOff) };
}
