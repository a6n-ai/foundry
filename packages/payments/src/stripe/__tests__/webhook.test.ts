import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { readFileSync } from "node:fs";
import { normalizeEvent, parseStripeEvent } from "../webhook";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8");
const stripe = new Stripe("sk_test_dummy", { apiVersion: "2026-09-30.endive" });
const secret = "whsec_test_secret";

describe("normalizeEvent", () => {
  it("paid", () => {
    expect(normalizeEvent(JSON.parse(fx("pi_succeeded")))).toEqual({
      kind: "paid", eventId: "evt_paid", piId: "pi_1", paymentRef: "pay_abc", amountCents: 20480, currency: "cad",
    });
  });
  it("failed", () => {
    expect(normalizeEvent(JSON.parse(fx("pi_failed")))).toMatchObject({ kind: "failed", piId: "pi_1", reason: "Your card was declined." });
  });
  it("refunded is cumulative", () => {
    expect(normalizeEvent(JSON.parse(fx("charge_refunded")))).toEqual({
      kind: "refunded", eventId: "evt_ref", piId: "pi_1", amountRefundedCents: 5000, fullyRefunded: false,
    });
  });
  it("disputed", () => {
    expect(normalizeEvent(JSON.parse(fx("dispute_created")))).toMatchObject({ kind: "disputed", disputeId: "dp_1", amountCents: 20480, reason: "fraudulent" });
  });
  it("ignores everything else", () => {
    expect(normalizeEvent(JSON.parse(fx("customer_created")))).toEqual({ kind: "ignored", eventId: "evt_ign", type: "customer.created" });
  });
});

describe("parseStripeEvent", () => {
  it("accepts a valid signature", async () => {
    const payload = fx("pi_succeeded");
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    const { normalized } = await parseStripeEvent(stripe, payload, header, secret);
    expect(normalized.kind).toBe("paid");
  });
  it("rejects a bad signature", async () => {
    const payload = fx("pi_succeeded");
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: "whsec_other" });
    await expect(parseStripeEvent(stripe, payload, header, secret)).rejects.toThrow();
  });
  it("rejects a tampered body", async () => {
    const payload = fx("pi_succeeded");
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    await expect(parseStripeEvent(stripe, payload.replace("20480", "1"), header, secret)).rejects.toThrow();
  });
});
