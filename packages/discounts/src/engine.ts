/**
 * Catalog discounts ADD UP as percents of the pre-discount subtotal, capped by
 * maxDiscountPct. Pure: no I/O, no clock. The caller pre-filters applicability.
 */
export type DiscountRule = { key: string; name: string; kind: string; percent: number; label?: string };

export type DiscountLine = {
  key: string;
  name: string;
  kind: string;
  /** Effective percent after cap scaling. */
  percent: number;
  listedPercent: number;
  amount: number;
};

export type CatalogResolution = {
  lines: DiscountLine[];
  totalPercent: number;
  totalAmount: number;
  capped: boolean;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function isRuleActive(
  rule: { active: boolean; startsAt?: number | null; endsAt?: number | null },
  now: number,
): boolean {
  if (!rule.active) return false;
  if (rule.startsAt != null && now < rule.startsAt) return false;
  if (rule.endsAt != null && now > rule.endsAt) return false;
  return true;
}

export function resolveCatalogDiscounts(
  rules: DiscountRule[],
  opts: { subtotal: number; maxDiscountPct: number },
): CatalogResolution {
  const subtotal = Number.isFinite(opts.subtotal) ? Math.max(0, opts.subtotal) : 0;
  const cap = Number.isFinite(opts.maxDiscountPct) ? clamp(opts.maxDiscountPct, 0, 100) : 0;
  const valid = rules
    .filter((r) => Number.isFinite(r.percent) && r.percent > 0)
    .map((r) => ({ r, listed: clamp(r.percent, 0, 100) }));
  const sum = valid.reduce((s, v) => s + v.listed, 0);
  const effectiveTotal = Math.min(sum, cap);
  const capped = sum > cap;
  const scale = sum > 0 ? effectiveTotal / sum : 0;
  const totalAmount = round2((subtotal * effectiveTotal) / 100);

  let used = 0;
  const lines: DiscountLine[] = valid.map(({ r, listed }, i) => {
    const percent = round2(listed * scale);
    const amount =
      i === valid.length - 1 ? round2(totalAmount - used) : round2((subtotal * listed * scale) / 100);
    used = round2(used + amount);
    return { key: r.key, name: r.name, kind: r.kind, percent, listedPercent: listed, amount };
  });
  return { lines, totalPercent: round2(effectiveTotal), totalAmount, capped };
}
