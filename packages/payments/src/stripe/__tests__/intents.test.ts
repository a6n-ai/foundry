import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { createAndConfirmIntent, previewConfirmationToken, chargeSavedCard, fetchIntentStatus, listCards } from "../intents";
import { parseStripeConfig } from "../config";
import { ensureCustomer } from "../customer";

function fake(over: Record<string, unknown> = {}) {
  return {
    paymentIntents: {
      create: vi.fn(async () => ({ id: "pi_1", status: "succeeded", client_secret: "cs" })),
      retrieve: vi.fn(async () => ({ id: "pi_1", status: "succeeded", amount_received: 1000, currency: "cad", metadata: { paymentRef: "p1" }, created: 1 })),
    },
    confirmationTokens: { retrieve: vi.fn(async () => ({ payment_method_preview: { card: { funding: "credit", brand: "visa", last4: "4242" } } })) },
    ...over,
  } as unknown as Stripe;
}

describe("intents", () => {
  it("creates with server amount, linked calc, idempotency key, and no payment_method_types", async () => {
    const s = fake();
    await createAndConfirmIntent(s, { amountCents: 20480, customerId: "cus_1", confirmationTokenId: "ctoken_1", paymentRef: "p1", taxCalculationId: "taxcalc_1", returnUrl: "https://x/me/pay/p1" });
    const [params, opts] = (s.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params).toMatchObject({
      amount: 20480, currency: "cad", customer: "cus_1", confirm: true, confirmation_token: "ctoken_1",
      setup_future_usage: "off_session", metadata: { paymentRef: "p1" },
      hooks: { inputs: { tax: { calculation: "taxcalc_1" } } },
    });
    expect(params).not.toHaveProperty("payment_method_types");
    expect(opts.idempotencyKey).toBe("pi:p1:20480:taxcalc_1:ctoken_1");
  });

  it("maps a card decline to failed without throwing", async () => {
    const err = Object.assign(new Error("Your card was declined."), { type: "StripeCardError", payment_intent: { id: "pi_9" } });
    const s = fake({ paymentIntents: { create: vi.fn(async () => { throw err; }) } });
    await expect(createAndConfirmIntent(s, { amountCents: 1, customerId: "c", confirmationTokenId: "t", paymentRef: "p", returnUrl: "u" }))
      .resolves.toEqual({ status: "failed", piId: "pi_9", clientSecret: null, reason: "Your card was declined." });
  });

  it("rethrows non-card errors", async () => {
    const s = fake({ paymentIntents: { create: vi.fn(async () => { throw Object.assign(new Error("boom"), { type: "StripeAPIError" }); }) } });
    await expect(createAndConfirmIntent(s, { amountCents: 1, customerId: "c", confirmationTokenId: "t", paymentRef: "p", returnUrl: "u" })).rejects.toThrow("boom");
  });

  it("previews funding", async () => {
    expect(await previewConfirmationToken(fake(), "ctoken_1")).toEqual({ funding: "credit", brand: "visa", last4: "4242", wallet: null });
  });

  it("flags wallet tokens", async () => {
    const s = fake({ confirmationTokens: { retrieve: vi.fn(async () => ({ payment_method_preview: { card: { funding: "debit", brand: "visa", last4: "1111", wallet: { type: "apple_pay" } } } })) } });
    expect((await previewConfirmationToken(s, "ctoken_2")).wallet).toBe("apple_pay");
  });

  it("lists cards default-first and skips non-card methods", async () => {
    const card = (id: string, last4: string) => ({ id, card: { brand: "visa", last4, funding: "credit", exp_month: 1, exp_year: 2030 } });
    const s = fake({
      customers: {
        retrieve: vi.fn(async () => ({ invoice_settings: { default_payment_method: "pm_b" } })),
        listPaymentMethods: vi.fn(async () => ({ data: [card("pm_a", "1111"), { id: "pm_x" }, card("pm_b", "2222")] })),
      },
    });
    const out = await listCards(s, "cus_1");
    expect(out.map((c) => [c.paymentMethodId, c.isDefault])).toEqual([["pm_b", true], ["pm_a", false]]);
    expect(out[0]).toEqual({ paymentMethodId: "pm_b", brand: "visa", last4: "2222", funding: "credit", expMonth: 1, expYear: 2030, isDefault: true });
  });

  it("charges a saved card on-session", async () => {
    const s = fake();
    await createAndConfirmIntent(s, { amountCents: 500, customerId: "cus_1", paymentMethodId: "pm_1", paymentRef: "p1", returnUrl: "https://x/r" });
    const [params, opts] = (s.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params).toMatchObject({ payment_method: "pm_1", confirm: true, return_url: "https://x/r" });
    expect(params).not.toHaveProperty("confirmation_token");
    expect(params).not.toHaveProperty("off_session");
    expect(opts.idempotencyKey).toBe("pi:p1:500:none:pm_1");
  });

  it("defaults the method label", () => {
    expect(parseStripeConfig({}).methodLabel).toBe("Pay with Stripe");
  });

  it("charges saved cards off-session", async () => {
    const s = fake();
    await chargeSavedCard(s, { amountCents: 500, customerId: "cus_1", paymentMethodId: "pm_1", paymentRef: "p1", attempt: "0" });
    const [params, opts] = (s.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params).toMatchObject({ off_session: true, confirm: true, payment_method: "pm_1" });
    expect(opts.idempotencyKey).toBe("charge:p1:500:none:pm_1:0");
  });

  it("maps off-session 3DS to requires_action", async () => {
    const err = Object.assign(new Error("Authentication required"), { type: "StripeCardError", code: "authentication_required", payment_intent: { id: "pi_a", status: "requires_payment_method", client_secret: "cs_a" } });
    const s = fake({ paymentIntents: { create: vi.fn(async () => { throw err; }) } });
    await expect(chargeSavedCard(s, { amountCents: 1, customerId: "c", paymentMethodId: "pm", paymentRef: "p", attempt: "1" }))
      .resolves.toEqual({ status: "requires_action", piId: "pi_a", clientSecret: "cs_a", reason: "Authentication required" });
  });

  it("maps idempotency errors to processing in both charge paths", async () => {
    const err = Object.assign(new Error("idem"), { type: "StripeIdempotencyError" });
    const s = fake({ paymentIntents: { create: vi.fn(async () => { throw err; }) } });
    const want = { status: "processing", piId: null, clientSecret: null, reason: "A charge for this payment is already in progress." };
    await expect(chargeSavedCard(s, { amountCents: 1, customerId: "c", paymentMethodId: "pm", paymentRef: "p", attempt: "1" })).resolves.toEqual(want);
    await expect(createAndConfirmIntent(s, { amountCents: 1, customerId: "c", confirmationTokenId: "t", paymentRef: "p", returnUrl: "u" })).resolves.toEqual(want);
  });

  it("includes a reason when a created intent is not successful", async () => {
    const s = fake({ paymentIntents: { create: vi.fn(async () => ({ id: "pi_f", status: "requires_payment_method", client_secret: "x", last_payment_error: { message: "nope" } })) } });
    await expect(createAndConfirmIntent(s, { amountCents: 1, customerId: "c", confirmationTokenId: "t", paymentRef: "p", returnUrl: "u" }))
      .resolves.toMatchObject({ status: "failed", reason: "nope" });
  });

  it("normalizes status", async () => {
    expect(await fetchIntentStatus(fake(), "pi_1")).toEqual({ piId: "pi_1", status: "succeeded", amountReceivedCents: 1000, currency: "cad", paymentRef: "p1", created: 1 });
  });
});

describe("ensureCustomer", () => {
  it("returns the stored id without creating", async () => {
    const create = vi.fn();
    const s = { customers: { create } } as unknown as Stripe;
    const store = { get: async () => "cus_old", set: vi.fn() };
    expect(await ensureCustomer(s, store, { ref: "u1", email: "a@b.c" })).toBe("cus_old");
    expect(create).not.toHaveBeenCalled();
  });
  it("creates with idempotency key then stores", async () => {
    const create = vi.fn(async () => ({ id: "cus_new" }));
    const s = { customers: { create } } as unknown as Stripe;
    const store = { get: async () => null, set: vi.fn(async () => {}) };
    expect(await ensureCustomer(s, store, { ref: "u1", email: "a@b.c" })).toBe("cus_new");
    expect((create.mock.calls[0] as unknown[])[1]).toEqual({ idempotencyKey: "customer:u1" });
    expect(store.set).toHaveBeenCalledWith("u1", "cus_new");
  });
});
