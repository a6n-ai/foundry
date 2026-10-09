import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { generateKeyB64, open } from "@foundry/commons/secret-box";
import { connectStripe, disconnectStripe, STRIPE_WEBHOOK_EVENTS } from "../connect";
import { updateStripeSettings, markStripeEvent } from "../connect";
import { stripePlugin } from "../plugin.server";

const mk = generateKeyB64();
const URL = "https://app/hook";
function harness(initial: Record<string, unknown> = {}, open_ = false) {
  let blob: Record<string, unknown> = { ...initial };
  const fakeStripe = {
    accounts: { retrieveCurrent: vi.fn(async () => ({ id: "acct_1" })) },
    webhookEndpoints: {
      create: vi.fn(async () => ({ id: "we_1", secret: "whsec_new" })),
      del: vi.fn(async () => ({})),
      retrieve: vi.fn(async () => ({ id: "we_1", status: "enabled", url: URL })),
      update: vi.fn(async () => ({})),
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
    await expect(connectStripe(h.deps, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: URL }, h.make)).rejects.toThrow(/rejected/);
    expect(h.blob().stripe).toBeUndefined();
  });

  it("refuses switching accounts while payments are open", async () => {
    const h = harness({ stripe: { installed: true, accountId: "acct_OLD" } }, true);
    await expect(connectStripe(h.deps, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: URL }, h.make)).rejects.toThrow(/open card payments/);
  });

  it("refuses without a master key", async () => {
    const h = harness();
    await expect(connectStripe({ ...h.deps, masterKey: () => undefined }, { secretKey: "rk_test_x", publishableKey: "pk_test_x", webhookUrl: URL }, h.make)).rejects.toThrow(/INTEGRATIONS_ENCRYPTION_KEY/);
  });

  it("disconnect deletes the endpoint and wipes secrets but keeps settings", async () => {
    const h = harness();
    await connectStripe(h.deps, { secretKey: "rk_test_x1234", publishableKey: "pk_test_x", webhookUrl: URL }, h.make);
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
    await connectStripe(h.deps, { secretKey: "rk_test_x1234", publishableKey: "pk_test_x", webhookUrl: URL }, h.make);
    expect((await p.status()).statusLabel).toBe("Connected · Test");
  });
});

const K = { secretKey: "rk_test_x1234", publishableKey: "pk_test_x", webhookUrl: URL };

describe("connectStripe hardening", () => {
  it("reuses the endpoint on reconnect (no create)", async () => {
    const h = harness();
    await connectStripe(h.deps, K, h.make);
    await connectStripe(h.deps, K, h.make);
    expect(h.fakeStripe.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    expect(h.fakeStripe.webhookEndpoints.update).not.toHaveBeenCalled();
  });
  it("repairs a disabled or moved endpoint via update", async () => {
    const h = harness();
    await connectStripe(h.deps, K, h.make);
    h.fakeStripe.webhookEndpoints.retrieve.mockResolvedValueOnce({ id: "we_1", status: "disabled", url: "https://old" } as never);
    await connectStripe(h.deps, K, h.make);
    expect(h.fakeStripe.webhookEndpoints.update).toHaveBeenCalledWith("we_1", expect.objectContaining({ url: URL, disabled: false }));
    expect(h.fakeStripe.webhookEndpoints.create).toHaveBeenCalledTimes(1);
  });
  it("recreates when retrieve is 404", async () => {
    const h = harness();
    await connectStripe(h.deps, K, h.make);
    h.fakeStripe.webhookEndpoints.retrieve.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "resource_missing" }));
    await connectStripe(h.deps, K, h.make);
    expect(h.fakeStripe.webhookEndpoints.create).toHaveBeenCalledTimes(2);
  });
  it("retrieve 500 errors and saves nothing new", async () => {
    const h = harness();
    await connectStripe(h.deps, K, h.make);
    const before = JSON.stringify(h.blob());
    h.fakeStripe.webhookEndpoints.retrieve.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    await expect(connectStripe(h.deps, K, h.make)).rejects.toThrow(/Couldn't reach Stripe/);
    expect(JSON.stringify(h.blob())).toBe(before);
    expect(h.fakeStripe.webhookEndpoints.create).toHaveBeenCalledTimes(1);
  });
  it("deletes the new endpoint when the save fails", async () => {
    const h = harness();
    h.deps.store.set = async () => { throw new Error("db down"); };
    await expect(connectStripe(h.deps, K, h.make)).rejects.toThrow("db down");
    expect(h.fakeStripe.webhookEndpoints.del).toHaveBeenCalledWith("we_1");
  });
  it("refuses a test-to-live switch with open payments", async () => {
    const h = harness({ stripe: { installed: true, accountId: "acct_1", livemode: false } }, true);
    await expect(connectStripe(h.deps, { secretKey: "rk_live_x1234", publishableKey: "pk_live_x", webhookUrl: URL }, h.make)).rejects.toThrow(/open card payments/);
  });
  it("rejects non-https webhook urls", async () => {
    const h = harness();
    await expect(connectStripe(h.deps, { ...K, webhookUrl: "http://evil" }, h.make)).rejects.toThrow(/https/);
  });
});

describe("corrupt stored config", () => {
  const corrupt = { stripe: { installed: "yes", secretKey: 5 } };
  it("is never overwritten by connect, markStripeEvent or install", async () => {
    const h = harness(corrupt);
    const before = JSON.stringify(h.blob());
    await expect(connectStripe(h.deps, K, h.make)).rejects.toThrow(/unreadable/);
    await expect(markStripeEvent(h.deps, 1)).rejects.toThrow(/unreadable/);
    await expect(stripePlugin(h.deps).install()).rejects.toThrow(/unreadable/);
    expect(JSON.stringify(h.blob())).toBe(before);
  });
});

describe("updateStripeSettings", () => {
  it("rejects unknown keys and NaN", async () => {
    const h = harness();
    await expect(updateStripeSettings(h.deps, { accountId: "acct_x" } as never)).rejects.toThrow("Invalid Stripe settings");
    await expect(updateStripeSettings(h.deps, { surcharge: { enabled: false, ratePct: NaN, excludeProvinces: [] } })).rejects.toThrow("Invalid Stripe settings");
    expect(h.blob().stripe).toBeUndefined();
  });
});
