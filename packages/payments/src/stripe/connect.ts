import type Stripe from "stripe";
import { open, seal } from "@foundry/commons/secret-box";
import { ValidationError } from "@foundry/commons";
import { STRIPE_API_VERSION, keyMode, stripePluginConfigSchema, secretHint, stripeConfigSaveError, stripeKeysError, type StripePluginConfig } from "./config";
import { clearStripeCache, createStripeClient } from "./client";
import type { StripeDeps } from "./types";

export const STRIPE_WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
] as const;

const settingsPatchSchema = stripePluginConfigSchema.pick({ methodLabel: true, tax: true, surcharge: true }).partial().strict();

export type ConnectDeps = StripeDeps & { hasOpenPayments: () => Promise<boolean> };

async function write(deps: StripeDeps, next: StripePluginConfig) {
  const blob = await deps.store.get();
  await deps.store.set({ ...blob, stripe: next });
  clearStripeCache();
}

// Writers must never replace unreadable stored settings with defaults.
export async function readStripeConfigStrict(deps: StripeDeps): Promise<StripePluginConfig> {
  const raw = (await deps.store.get())["stripe"];
  if (raw === undefined) return stripePluginConfigSchema.parse({});
  const parsed = stripePluginConfigSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Stored Stripe settings are unreadable — contact an engineer before reconnecting");
  return parsed.data;
}

function isGone(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number };
  return e?.code === "resource_missing" || e?.statusCode === 404;
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
  if (!i.webhookUrl.startsWith("https://") && !i.webhookUrl.startsWith("http://localhost")) throw new ValidationError("Webhook URL must be https");
  const mk = deps.masterKey();
  if (!mk) throw new ValidationError("Server is missing INTEGRATIONS_ENCRYPTION_KEY — ask an engineer to set it");

  const prev = await readStripeConfigStrict(deps);
  const stripe = make(secretKey);
  let account: Stripe.Account;
  try {
    account = await stripe.accounts.retrieveCurrent();
  } catch (err) {
    const t = (err as { type?: string })?.type;
    throw new ValidationError(t === "StripeAuthenticationError" || t === "StripePermissionError"
      ? "Stripe rejected this key — check it and its permissions"
      : "Couldn't reach Stripe. Try again.");
  }

  const livemode = keyMode(secretKey) === "live";
  const sameIdentity = prev.accountId === account.id && prev.livemode === livemode;
  if (prev.accountId && !sameIdentity && (await deps.hasOpenPayments())) {
    throw new ValidationError("This key belongs to a different Stripe account or mode and there are open card payments on the current one. Settle or cancel them first.");
  }

  let webhookEndpointId = sameIdentity ? prev.webhookEndpointId : undefined;
  let webhookSecret = sameIdentity ? prev.webhookSecret : undefined;
  if (webhookEndpointId && webhookSecret) {
    let ep: Stripe.WebhookEndpoint | undefined;
    try {
      ep = await stripe.webhookEndpoints.retrieve(webhookEndpointId);
    } catch (err) {
      if (!isGone(err)) throw new ValidationError("Couldn't reach Stripe to check the webhook endpoint. Try again.");
      webhookEndpointId = undefined;
      webhookSecret = undefined;
    }
    if (ep && (ep.url !== i.webhookUrl || ep.status === "disabled")) {
      await stripe.webhookEndpoints.update(ep.id, { url: i.webhookUrl, disabled: false, enabled_events: [...STRIPE_WEBHOOK_EVENTS] });
    }
  }
  let createdId: string | undefined;
  if (!webhookEndpointId || !webhookSecret) {
    const ep = await stripe.webhookEndpoints.create({
      url: i.webhookUrl,
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      api_version: STRIPE_API_VERSION,
      description: "Foundry payments",
    });
    createdId = ep.id;
    if (!ep.secret) {
      try { await stripe.webhookEndpoints.del(ep.id); } catch { /* best effort */ }
      throw new ValidationError("Stripe did not return a webhook signing secret");
    }
    webhookEndpointId = ep.id;
    webhookSecret = seal(ep.secret, mk, "stripe.webhookSecret");
  }

  try {
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
  } catch (err) {
    if (createdId) { try { await stripe.webhookEndpoints.del(createdId); } catch { /* best effort */ } }
    throw err;
  }

  // Identity changed: the old account's endpoint is orphaned, so remove it with the old key.
  if (prev.accountId && !sameIdentity && prev.secretKey && prev.webhookEndpointId) {
    try { await make(open(prev.secretKey, mk, "stripe.secretKey")).webhookEndpoints.del(prev.webhookEndpointId); } catch { /* best effort */ }
  }
  return { accountId: account.id, livemode };
}

export async function disconnectStripe(deps: ConnectDeps, make: (k: string) => Stripe = createStripeClient): Promise<void> {
  if (await deps.hasOpenPayments()) throw new ValidationError("There are open card payments. Settle or cancel them before disconnecting Stripe.");
  const prev = await readStripeConfigStrict(deps);
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
  const parsed = settingsPatchSchema.safeParse(patch);
  if (!parsed.success) throw new ValidationError("Invalid Stripe settings");
  const prev = await readStripeConfigStrict(deps);
  const next = { ...prev, ...parsed.data };
  const err = stripeConfigSaveError(next);
  if (err) throw new ValidationError(err);
  await write(deps, next);
}

// Does not clear the client cache: the key didn't change.
export async function markStripeEvent(deps: StripeDeps, at: number): Promise<void> {
  const prev = await readStripeConfigStrict(deps);
  const blob = await deps.store.get();
  await deps.store.set({ ...blob, stripe: { ...prev, lastEventAt: at } });
}
