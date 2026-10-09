import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { createAndConfirmIntent, previewConfirmationToken, chargeSavedCard, fetchIntentStatus } from "../intents";
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
    expect(await previewConfirmationToken(fake(), "ctoken_1")).toEqual({ funding: "credit", brand: "visa", last4: "4242" });
  });

  it("charges saved cards off-session", async () => {
    const s = fake();
    await chargeSavedCard(s, { amountCents: 500, customerId: "cus_1", paymentMethodId: "pm_1", paymentRef: "p1" });
    const [params, opts] = (s.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params).toMatchObject({ off_session: true, confirm: true, payment_method: "pm_1" });
    expect(opts.idempotencyKey).toBe("charge:p1:500:none");
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
