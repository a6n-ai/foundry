import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { generateKeyB64, open } from "@foundry/commons/secret-box";
import { connectStripe, disconnectStripe, STRIPE_WEBHOOK_EVENTS } from "../connect";
import { stripePlugin } from "../plugin.server";

const mk = generateKeyB64();
function harness(initial: Record<string, unknown> = {}, open_ = false) {
  let blob: Record<string, unknown> = { ...initial };
  const fakeStripe = {
    accounts: { retrieveCurrent: vi.fn(async () => ({ id: "acct_1" })) },
    webhookEndpoints: {
      create: vi.fn(async () => ({ id: "we_1", secret: "whsec_new" })),
      del: vi.fn(async () => ({})),
      retrieve: vi.fn(async () => ({ id: "we_1", status: "enabled" })),
    },
  };
  const deps = {
    store: { get: async () => blob, set: async (b: Record<string, unknown>) => { blob = b; } },
    masterKey: () => mk,
    hasOpenPayments: async () => open_,
  };
  return { deps, fakeStripe, blob: () => blob, make: () => fakeStripe as unknown as Stripe };
}

describe("connectStripe", () => {
  it("validates, creates the webhook, encrypts, and saves", async () => {
    const h = harness();
    const r = await connectStripe(h.deps, { secretKey: "rk_test_abcdefgh1234", publishableKey: "pk_test_x", webhookUrl: "https://app/api/webhooks/stripe" }, h.make);
    expect(r).toEqual({ accountId: "acct_1", livemode: false });
    expect(h.fakeStripe.webhookEndpoints.create).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://app/api/webhooks/stripe", enabled_events: [...STRIPE_WEBHOOK_EVENTS], api_version: "2026-09-30.endive",
    }));
    const s = (h.blob().stripe ?? {}) as Record<string, any>;
    expect(JSON.stringify(s)).not.toContain("rk_test_abcdefgh1234");
    expect(JSON.stringify(s)).not.toContain("whsec_new");
    expect(open(s.secretKey, mk, "stripe.secretKey")).toBe("rk_test_abcdefgh1234");
    expect(open(s.webhookSecret, mk, "stripe.webhookSecret")).toBe("whsec_new");
    expect(s).toMatchObject({ installed: true, accountId: "acct_1", livemode: false, webhookEndpointId: "we_1", secretKeyHint: "rk_test_…1234" });
  });

  it("saves nothing when the key is rejected", async () => {
    const h = harness();
    h.fakeStripe.accounts.retrieveCurrent.mockRejectedValueOnce(Object.assign(new Error("Invalid API Key"), { type: "StripeAuthenticationError" }));
    await expect(connectStripe(h.deps, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: "u" }, h.make)).rejects.toThrow(/rejected/);
    expect(h.blob().stripe).toBeUndefined();
  });

  it("refuses switching accounts while payments are open", async () => {
    const h = harness({ stripe: { installed: true, accountId: "acct_OLD" } }, true);
    await expect(connectStripe(h.deps, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: "u" }, h.make)).rejects.toThrow(/open card payments/);
  });

  it("refuses without a master key", async () => {
    const h = harness();
    await expect(connectStripe({ ...h.deps, masterKey: () => undefined }, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: "u" }, h.make)).rejects.toThrow(/INTEGRATIONS_ENCRYPTION_KEY/);
  });

  it("disconnect deletes the endpoint and wipes secrets but keeps settings", async () => {
    const h = harness();
    await connectStripe(h.deps, { secretKey: "rk_test_x1234", publishableKey: "pk_test_x", webhookUrl: "u" }, h.make);
    await disconnectStripe(h.deps, h.make);
    expect(h.fakeStripe.webhookEndpoints.del).toHaveBeenCalledWith("we_1");
    const s = h.blob().stripe as Record<string, unknown>;
    expect(s.secretKey).toBeUndefined();
    expect(s.webhookSecret).toBeUndefined();
    expect(s.installed).toBe(false);
    expect(s.surcharge).toBeDefined();
  });
});

describe("stripePlugin", () => {
  it("install flips installed; status reflects connect", async () => {
    const h = harness();
    const p = stripePlugin(h.deps);
    expect(await p.status()).toMatchObject({ installed: false });
    await p.install();
    expect((h.blob().stripe as any).installed).toBe(true);
    expect((await p.status()).statusLabel).toBe("Installed · not connected");
    await connectStripe(h.deps, { secretKey: "rk_test_x1234", publishableKey: "pk_test_x", webhookUrl: "u" }, h.make);
    expect((await p.status()).statusLabel).toBe("Connected · Test");
  });
});
