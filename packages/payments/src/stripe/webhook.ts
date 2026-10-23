import type Stripe from "stripe";

export type StripeNormalized =
  | { kind: "paid"; eventId: string; piId: string; paymentRef: string | null; amountCents: number; currency: string }
  | { kind: "failed"; eventId: string; piId: string; paymentRef: string | null; reason: string }
  | { kind: "refunded"; eventId: string; piId: string; amountRefundedCents: number; fullyRefunded: boolean }
  | { kind: "disputed"; eventId: string; piId: string; disputeId: string; amountCents: number; reason: string }
  | { kind: "ignored"; eventId: string; type: string };

const idOf = (x: string | { id: string } | null | undefined): string | null => (x == null ? null : typeof x === "string" ? x : x.id);

export function normalizeEvent(event: Stripe.Event): StripeNormalized {
  const eventId = event.id;
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      return { kind: "paid", eventId, piId: pi.id, paymentRef: pi.metadata?.paymentRef ?? null, amountCents: pi.amount_received, currency: pi.currency };
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      return { kind: "failed", eventId, piId: pi.id, paymentRef: pi.metadata?.paymentRef ?? null, reason: pi.last_payment_error?.message ?? "Payment failed" };
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const piId = idOf(ch.payment_intent);
      if (!piId) return { kind: "ignored", eventId, type: event.type };
      return { kind: "refunded", eventId, piId, amountRefundedCents: ch.amount_refunded, fullyRefunded: ch.refunded };
    }
    case "charge.dispute.created": {
      const dp = event.data.object as Stripe.Dispute;
      const piId = idOf(dp.payment_intent);
      if (!piId) return { kind: "ignored", eventId, type: event.type };
      return { kind: "disputed", eventId, piId, disputeId: dp.id, amountCents: dp.amount, reason: dp.reason };
    }
    default:
      return { kind: "ignored", eventId, type: event.type };
  }
}

export async function parseStripeEvent(stripe: Stripe, rawBody: string, signature: string, secret: string) {
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  return { event, normalized: normalizeEvent(event) };
}
