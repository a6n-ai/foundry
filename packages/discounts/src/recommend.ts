import { round2 } from "./engine";

export type DealAlternative<T> = { id: string; label: string; total: number; units: number; payload: T };
export type RankedDeal<T> = {
  id: string;
  label: string;
  payload: T;
  perUnit: number;
  savingPerUnit: number;
  savingPct: number;
  totalDelta: number;
};

export function rankDeals<T>(
  current: { total: number; units: number },
  alternatives: DealAlternative<T>[],
  opts: { limit?: number; minSavingPct?: number } = {},
): RankedDeal<T>[] {
  if (!(current.units > 0) || !(current.total > 0)) return [];
  const minPct = opts.minSavingPct ?? 1;
  const cur = current.total / current.units;
  const ranked = alternatives
    .filter((a) => a.units > 0 && Number.isFinite(a.total))
    .map((a) => {
      const per = a.total / a.units;
      return {
        id: a.id,
        label: a.label,
        payload: a.payload,
        perUnit: round2(per),
        savingPerUnit: round2(cur - per),
        savingPct: round2(((cur - per) / cur) * 100),
        totalDelta: round2(a.total - current.total),
        raw: cur - per,
      };
    })
    .filter((d) => d.raw > 0 && d.savingPct >= minPct)
    .sort((a, b) => b.raw - a.raw)
    .map(({ raw: _r, ...d }) => d);
  return opts.limit != null ? ranked.slice(0, opts.limit) : ranked;
}

export function bestDeal<T>(
  current: { total: number; units: number },
  alternatives: DealAlternative<T>[],
  opts?: { minSavingPct?: number },
): RankedDeal<T> | null {
  return rankDeals(current, alternatives, { ...opts, limit: 1 })[0] ?? null;
}
