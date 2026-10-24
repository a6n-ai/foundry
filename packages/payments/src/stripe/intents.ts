import type Stripe from "stripe";
import type { CardFunding } from "./surcharge";
import type { CardPreview, IntentResult, IntentStatus, SavedCard } from "./types";

const FUNDING = new Set(["credit", "debit", "prepaid", "unknown"]);
const funding = (f: string | null | undefined): CardFunding => (f && FUNDING.has(f) ? (f as CardFunding) : "unknown");

function toResult(pi: Pick<Stripe.PaymentIntent, "id" | "status" | "client_secret" | "last_payment_error">): IntentResult {
  const status = pi.status === "succeeded" ? "succeeded"
    : pi.status === "processing" ? "processing"
    : pi.status === "requires_action" ? "requires_action"
    : "failed";
  return {
    status, piId: pi.id, clientSecret: pi.client_secret ?? null,
    ...(status === "failed" ? { reason: pi.last_payment_error?.message ?? "Payment failed" } : {}),
  };
}

const IDEMPOTENCY_REASON = "A charge for this payment is already in progress.";

function idempotencyFailure(e: unknown): IntentResult | null {
  if ((e as { type?: string })?.type !== "StripeIdempotencyError") return null;
  return { status: "processing", piId: null, clientSecret: null, reason: IDEMPOTENCY_REASON };
}

function cardFailure(e: unknown): IntentResult | null {
  const err = e as { type?: string; message?: string; payment_intent?: { id: string } };
  if (err?.type !== "StripeCardError") return null;
  return { status: "failed", piId: err.payment_intent?.id ?? null, clientSecret: null, reason: err.message ?? "Card declined" };
}

export async function previewConfirmationToken(stripe: Stripe, tokenId: string): Promise<CardPreview> {
  const t = await stripe.confirmationTokens.retrieve(tokenId);
  const type = t.payment_method_preview?.type ?? null;
  const c = t.payment_method_preview?.card;
  // Link exposes no card details before the charge; report it as a wallet so callers apply wallet policy.
  const wallet = type === "link" ? "link" : c?.wallet?.type ?? null;
  return { type, funding: funding(c?.funding), brand: c?.brand ?? null, last4: c?.last4 ?? null, wallet };
}

export async function createAndConfirmIntent(stripe: Stripe, i: {
  amountCents: number; customerId: string; paymentRef: string;
  orgRef?: string | null; taxCalculationId?: string | null; returnUrl: string; description?: string;
  /** Retry counter for saved-card (paymentMethodId) charges: a new value gives a fresh idempotency key after a decline or abandoned 3DS. */
  attempt?: string;
} & ({ confirmationTokenId: string; paymentMethodId?: never } | { paymentMethodId: string; confirmationTokenId?: never })): Promise<IntentResult> {
  const source = i.confirmationTokenId ? { confirmation_token: i.confirmationTokenId } : { payment_method: i.paymentMethodId };
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: i.amountCents,
        currency: "cad",
        customer: i.customerId,
        confirm: true,
        ...source,
        setup_future_usage: "off_session",
        return_url: i.returnUrl,
        description: i.description,
        metadata: { paymentRef: i.paymentRef, ...(i.orgRef ? { orgRef: i.orgRef } : {}) },
        ...(i.taxCalculationId ? { hooks: { inputs: { tax: { calculation: i.taxCalculationId } } } } : {}),
      },
      { idempotencyKey: `pi:${i.paymentRef}:${i.amountCents}:${i.taxCalculationId ?? "none"}:${i.confirmationTokenId ?? i.paymentMethodId}${i.attempt ? `:${i.attempt}` : ""}` },
    );
    return toResult(pi);
  } catch (e) {
    const failed = cardFailure(e) ?? idempotencyFailure(e);
    if (failed) return failed;
    throw e;
  }
}

export async function listCards(stripe: Stripe, customerId: string): Promise<SavedCard[]> {
  const [customer, list] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.customers.listPaymentMethods(customerId, { limit: 10 }),
  ]);
  const def = "deleted" in customer ? null : (customer.invoice_settings?.default_payment_method ?? null);
  const defId = typeof def === "string" ? def : def?.id ?? null;
  const cards = list.data.flatMap((p) => p.card ? [{
    paymentMethodId: p.id, brand: p.card.brand ?? null, last4: p.card.last4 ?? null, funding: funding(p.card.funding),
    expMonth: p.card.exp_month, expYear: p.card.exp_year, isDefault: p.id === defId,
  }] : []);
  return cards.sort((x, y) => Number(y.isDefault) - Number(x.isDefault));
}

export async function defaultCard(stripe: Stripe, customerId: string) {
  const c = (await listCards(stripe, customerId))[0];
  return c ? { paymentMethodId: c.paymentMethodId, funding: c.funding, brand: c.brand, last4: c.last4 } : null;
}

export async function chargeSavedCard(stripe: Stripe, i: {
  amountCents: number; customerId: string; paymentMethodId: string; paymentRef: string;
  orgRef?: string | null; taxCalculationId?: string | null;
  /** Caller-owned retry counter: the number of prior definitively failed charges for this payment. Same value = same Stripe idempotency key, so concurrent clicks collapse into one charge. */
  attempt: string;
}): Promise<IntentResult> {
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: i.amountCents,
        currency: "cad",
        customer: i.customerId,
        payment_method: i.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { paymentRef: i.paymentRef, ...(i.orgRef ? { orgRef: i.orgRef } : {}) },
        ...(i.taxCalculationId ? { hooks: { inputs: { tax: { calculation: i.taxCalculationId } } } } : {}),
      },
      { idempotencyKey: `charge:${i.paymentRef}:${i.amountCents}:${i.taxCalculationId ?? "none"}:${i.paymentMethodId}:${i.attempt}` },
    );
    return toResult(pi);
  } catch (e) {
    const err = e as { code?: string; payment_intent?: { id: string; client_secret?: string | null } };
    const failed = cardFailure(e);
    if (failed && err.code === "authentication_required") {
      const pi = err.payment_intent;
      return { status: "requires_action", piId: pi?.id ?? null, clientSecret: pi?.client_secret ?? null, reason: failed.reason };
    }
    const out = failed ?? idempotencyFailure(e);
    if (out) return out;
    throw e;
  }
}

function toStatus(pi: Stripe.PaymentIntent): IntentStatus {
  const known = ["succeeded", "processing", "requires_action", "requires_payment_method", "canceled"] as const;
  const status = (known as readonly string[]).includes(pi.status) ? (pi.status as IntentStatus["status"]) : "other";
  return { piId: pi.id, status, amountReceivedCents: pi.amount_received, currency: pi.currency, paymentRef: pi.metadata?.paymentRef ?? null, created: pi.created };
}

export async function fetchIntentStatus(stripe: Stripe, piId: string): Promise<IntentStatus> {
  return toStatus(await stripe.paymentIntents.retrieve(piId));
}

export async function listIntents(stripe: Stripe, range: { fromSec: number; toSec: number }, startingAfter?: string) {
  const page = await stripe.paymentIntents.list({ created: { gte: range.fromSec, lte: range.toSec }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
  const items = page.data.map(toStatus);
  return { items, nextCursor: page.has_more ? page.data[page.data.length - 1]!.id : null };
}

export async function refundIntent(stripe: Stripe, piId: string, amountCents: number | null, idemKey: string): Promise<string> {
  const r = await stripe.refunds.create({ payment_intent: piId, ...(amountCents != null ? { amount: amountCents } : {}) }, { idempotencyKey: idemKey });
  return r.id;
}
