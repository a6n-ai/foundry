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

// Largest-remainder split of targetCents over exact (fractional) cent shares: every share >= 0 and
// the sum is exactly targetCents, unlike dumping the rounding residual on the last line.
function allocateCents(exact: number[], targetCents: number): number[] {
  const out = exact.map((e) => Math.max(0, Math.floor(e + 1e-9)));
  let diff = targetCents - out.reduce((s, c) => s + c, 0);
  const order = exact.map((e, i) => i).sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));
  for (let k = 0; diff > 0 && order.length; k++, diff--) out[order[k % order.length]] += 1;
  for (let k = 0; diff < 0 && order.length; k++) {
    const i = order[k % order.length];
    if (out[i] > 0) { out[i] -= 1; diff++; }
  }
  return out;
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

  const cents = allocateCents(
    valid.map(({ listed }) => subtotal * listed * scale),
    Math.round(totalAmount * 100),
  );
  const lines: DiscountLine[] = valid.map(({ r, listed }, i) => ({
    key: r.key, name: r.name, kind: r.kind, percent: round2(listed * scale), listedPercent: listed, amount: cents[i] / 100,
  }));
  return { lines, totalPercent: round2(effectiveTotal), totalAmount, capped };
}
