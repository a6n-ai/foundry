import { SURCHARGE_MAX_PCT, type StripePluginConfig } from "./config";

export type CardFunding = "credit" | "debit" | "prepaid" | "unknown";

/** Credit-only surcharge in cents. Unknown province ⇒ 0 (can't prove it is outside an excluded one). */
export function surchargeCents(i: {
  funding: CardFunding | null;
  province: string | null;
  baseCents: number;
  cfg: StripePluginConfig["surcharge"];
}): number {
  if (!i.cfg.enabled || i.funding !== "credit" || !i.province) return 0;
  if (i.cfg.excludeProvinces.includes(i.province.toUpperCase())) return 0;
  const rate = Math.min(i.cfg.ratePct, SURCHARGE_MAX_PCT);
  return Math.round((i.baseCents * rate) / 100);
}
