type MoneyOpts = { whole?: boolean; narrow?: boolean };

/**
 * Amounts are major units. INR keeps Indian digit grouping; everything else uses en-CA so CAD renders "$1.00"
 * and not "CA$1.00". Currency defaults to CAD only for legacy one-arg callers; pass it explicitly in new code.
 */
export function formatMoney(amount: number, currency = "CAD", { whole, narrow }: MoneyOpts = {}): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-CA", {
    style: "currency",
    currency,
    ...(whole && { maximumFractionDigits: 0 }),
    ...(narrow && { currencyDisplay: "narrowSymbol" }),
  }).format(amount);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Whole units of `rate` that fit in `value`, floored so a unit worth more than what is left is never taken.
 * The epsilon keeps 0.3 / 0.1 = 2.9999... at 3.
 */
export function coinsFor(value: number, rate: number): number {
  return Math.floor(value / rate + 1e-9);
}
