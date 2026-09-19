/**
 * Append-only money ledger primitives shared by every Realm app.
 * Apps persist their own `payments` / `ledger_entries` rows (snowflake ids live
 * in app SQL) and map the payable — booking, order, etc. — onto `reference`.
 * Corrections are new `adjustment` rows, never edits.
 */

export const LEDGER_DIRECTIONS = ["debit", "credit"] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_ENTRY_TYPES = ["payment", "refund", "discount", "adjustment"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export type MoneyLedgerWrite = {
  direction: LedgerDirection;
  type: LedgerEntryType;
  /** Major currency units, two decimal places (e.g. "68.00"). */
  amount: string;
  currency: string;
  /** Public id of the payable (booking, order, …). */
  reference: string;
  /**
   * Provider event id (Stripe `evt_…`, etc.). Unique per tenant so a second
   * webhook delivery is a no-op.
   */
  providerEventId?: string;
};

const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMajorAmount(amount: number): string {
  return round2(amount).toFixed(2);
}

/** Smallest currency unit for online providers (Stripe PaymentIntents, etc.). */
export function toMinorUnits(amount: number, currency: string): number {
  const factor = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
  return Math.round(amount * factor);
}

export function paymentCredit(
  amount: number,
  currency: string,
  reference: string,
  providerEventId?: string,
): MoneyLedgerWrite {
  return {
    direction: "credit",
    type: "payment",
    amount: formatMajorAmount(amount),
    currency,
    reference,
    providerEventId,
  };
}

export function refundDebit(
  amount: number,
  currency: string,
  reference: string,
  providerEventId?: string,
): MoneyLedgerWrite {
  return {
    direction: "debit",
    type: "refund",
    amount: formatMajorAmount(amount),
    currency,
    reference,
    providerEventId,
  };
}

/** True when this provider event was already settled — skip a second write. */
export function isDuplicateProviderEvent(existingId: string | null | undefined): boolean {
  return Boolean(existingId);
}
