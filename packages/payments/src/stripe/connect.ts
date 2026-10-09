import type Stripe from "stripe";
import { open, seal } from "@foundry/commons/secret-box";
import { ValidationError } from "@foundry/commons";
import { STRIPE_API_VERSION, keyMode, parseStripeConfig, secretHint, stripeConfigSaveError, stripeKeysError, type StripePluginConfig } from "./config";
import { clearStripeCache, createStripeClient } from "./client";
import type { StripeDeps } from "./types";

export const STRIPE_WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
] as const;

export type ConnectDeps = StripeDeps & { hasOpenPayments: () => Promise<boolean> };

async function write(deps: StripeDeps, next: StripePluginConfig) {
  const blob = await deps.store.get();
  await deps.store.set({ ...blob, stripe: next });
  clearStripeCache();
}

export async function connectStripe(
  deps: ConnectDeps,
  i: { secretKey: string; publishableKey: string; webhookUrl: string },
  make: (k: string) => Stripe = createStripeClient,
): Promise<{ accountId: string; livemode: boolean }> {
  const secretKey = i.secretKey.trim();
  const publishableKey = i.publishableKey.trim();
  const keyErr = stripeKeysError(secretKey, publishableKey);
  if (keyErr) throw new ValidationError(keyErr);
  const mk = deps.masterKey();
  if (!mk) throw new ValidationError("Server is missing INTEGRATIONS_ENCRYPTION_KEY — ask an engineer to set it");

  const stripe = make(secretKey);
  let account: Stripe.Account;
  try {
    account = await stripe.accounts.retrieveCurrent();
  } catch {
    throw new ValidationError("Stripe rejected this key — check it and its permissions");
  }

  const prev = parseStripeConfig((await deps.store.get())["stripe"]);
  if (prev.accountId && prev.accountId !== account.id && (await deps.hasOpenPayments())) {
    throw new ValidationError("This key belongs to a different Stripe account and there are open card payments on the current one. Settle or cancel them first.");
  }

  // Reuse the endpoint only when it is the same account; otherwise create one on the new account.
  let webhookEndpointId = prev.accountId === account.id ? prev.webhookEndpointId : undefined;
  let webhookSecret = prev.accountId === account.id ? prev.webhookSecret : undefined;
  if (webhookEndpointId) {
    try { await stripe.webhookEndpoints.retrieve(webhookEndpointId); } catch { webhookEndpointId = undefined; webhookSecret = undefined; }
  }
  if (!webhookEndpointId || !webhookSecret) {
    const ep = await stripe.webhookEndpoints.create({
      url: i.webhookUrl,
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      api_version: STRIPE_API_VERSION,
      description: "Foundry payments",
    });
    webhookEndpointId = ep.id;
    webhookSecret = seal(ep.secret!, mk, "stripe.webhookSecret");
  }

  const livemode = keyMode(secretKey) === "live";
  await write(deps, {
    ...prev,
    installed: true,
    secretKey: seal(secretKey, mk, "stripe.secretKey"),
    secretKeyHint: secretHint(secretKey),
    publishableKey,
    webhookEndpointId,
    webhookSecret,
    accountId: account.id,
    livemode,
    connectedAt: Date.now(),
  });
  return { accountId: account.id, livemode };
}

export async function disconnectStripe(deps: ConnectDeps, make: (k: string) => Stripe = createStripeClient): Promise<void> {
  if (await deps.hasOpenPayments()) throw new ValidationError("There are open card payments. Settle or cancel them before disconnecting Stripe.");
  const prev = parseStripeConfig((await deps.store.get())["stripe"]);
  const mk = deps.masterKey();
  if (prev.secretKey && prev.webhookEndpointId && mk) {
    try { await make(open(prev.secretKey, mk, "stripe.secretKey")).webhookEndpoints.del(prev.webhookEndpointId); } catch { /* endpoint already gone or key revoked */ }
  }
  const { secretKey: _s, webhookSecret: _w, webhookEndpointId: _e, secretKeyHint: _h, publishableKey: _p, accountId: _a, ...rest } = prev;
  await write(deps, { ...rest, installed: false });
}

export async function updateStripeSettings(
  deps: StripeDeps,
  patch: Partial<Pick<StripePluginConfig, "methodLabel" | "tax" | "surcharge">>,
): Promise<void> {
  const prev = parseStripeConfig((await deps.store.get())["stripe"]);
  const next = { ...prev, ...patch };
  const err = stripeConfigSaveError(next);
  if (err) throw new ValidationError(err);
  await write(deps, next);
}

// Does not clear the client cache: the key didn't change.
export async function markStripeEvent(deps: StripeDeps, at: number): Promise<void> {
  const blob = await deps.store.get();
  const prev = parseStripeConfig(blob["stripe"]);
  await deps.store.set({ ...blob, stripe: { ...prev, lastEventAt: at } });
}
