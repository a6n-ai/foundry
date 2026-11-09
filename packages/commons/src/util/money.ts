const DEFAULT_LOCALE = "en-CA";
const DEFAULT_CURRENCY = "CAD";

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/**
 * Whole units of `rate` that fit in `value`, floored so a unit worth more than what is left is never taken.
 * The epsilon keeps 0.3 / 0.1 = 2.9999... at 3.
 */
export function coinsFor(value: number, rate: number): number {
  return Math.floor(value / rate + 1e-9);
}
