import type Stripe from "stripe";
import type { CardFunding } from "./surcharge";
import type { CardPreview, IntentResult, IntentStatus } from "./types";

const FUNDING = new Set(["credit", "debit", "prepaid", "unknown"]);
const funding = (f: string | null | undefined): CardFunding => (f && FUNDING.has(f) ? (f as CardFunding) : "unknown");

function toResult(pi: Pick<Stripe.PaymentIntent, "id" | "status" | "client_secret">): IntentResult {
  const status = pi.status === "succeeded" ? "succeeded"
    : pi.status === "processing" ? "processing"
    : pi.status === "requires_action" ? "requires_action"
    : "failed";
  return { status, piId: pi.id, clientSecret: pi.client_secret ?? null };
}

function cardFailure(e: unknown): IntentResult | null {
  const err = e as { type?: string; message?: string; payment_intent?: { id: string } };
  if (err?.type !== "StripeCardError") return null;
  return { status: "failed", piId: err.payment_intent?.id ?? null, clientSecret: null, reason: err.message ?? "Card declined" };
}

export async function previewConfirmationToken(stripe: Stripe, tokenId: string): Promise<CardPreview> {
  const t = await stripe.confirmationTokens.retrieve(tokenId);
  const c = t.payment_method_preview?.card;
  return { funding: funding(c?.funding), brand: c?.brand ?? null, last4: c?.last4 ?? null };
}

export async function createAndConfirmIntent(stripe: Stripe, i: {
  amountCents: number; customerId: string; confirmationTokenId: string; paymentRef: string;
  orgRef?: string | null; taxCalculationId?: string | null; returnUrl: string; description?: string;
}): Promise<IntentResult> {
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: i.amountCents,
        currency: "cad",
        customer: i.customerId,
        confirm: true,
        confirmation_token: i.confirmationTokenId,
        setup_future_usage: "off_session",
        return_url: i.returnUrl,
        description: i.description,
        metadata: { paymentRef: i.paymentRef, ...(i.orgRef ? { orgRef: i.orgRef } : {}) },
        ...(i.taxCalculationId ? { hooks: { inputs: { tax: { calculation: i.taxCalculationId } } } } : {}),
      },
      { idempotencyKey: `pi:${i.paymentRef}:${i.amountCents}:${i.taxCalculationId ?? "none"}:${i.confirmationTokenId}` },
    );
    return toResult(pi);
  } catch (e) {
    const failed = cardFailure(e);
    if (failed) return failed;
    throw e;
  }
}

export async function defaultCard(stripe: Stripe, customerId: string) {
  const list = await stripe.customers.listPaymentMethods(customerId, { limit: 10 });
  const pm = list.data.find((p) => p.card);
  if (!pm?.card) return null;
  return { paymentMethodId: pm.id, funding: funding(pm.card.funding), brand: pm.card.brand ?? null, last4: pm.card.last4 ?? null };
}

export async function chargeSavedCard(stripe: Stripe, i: {
  amountCents: number; customerId: string; paymentMethodId: string; paymentRef: string;
  orgRef?: string | null; taxCalculationId?: string | null;
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
      { idempotencyKey: `charge:${i.paymentRef}:${i.amountCents}:${i.taxCalculationId ?? "none"}` },
    );
    return toResult(pi);
  } catch (e) {
    const failed = cardFailure(e);
    if (failed) {
      // authentication_required surfaces as a card error carrying a requires_action PI
      const pi = (e as { payment_intent?: { status?: string } }).payment_intent;
      return pi?.status === "requires_action" ? { ...failed, status: "requires_action" } : failed;
    }
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
