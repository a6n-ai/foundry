import Stripe from "stripe";
import { open, isEnvelope } from "@foundry/commons/secret-box";
import { STRIPE_API_VERSION, parseStripeConfig, type StripePluginConfig } from "./config";
import type { StripeDeps } from "./types";

export class StripeNotConfiguredError extends Error {
  constructor(reason: string) { super(`Stripe is not configured: ${reason}`); }
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 10_000,
    appInfo: { name: "foundry-payments" },
  });
}

// Keyed by account + ciphertext: replacing the key changes ct, so a stale client is never reused.
const cache = new Map<string, Stripe>();
export function clearStripeCache(): void { cache.clear(); }

export async function readStripeConfig(deps: StripeDeps): Promise<StripePluginConfig> {
  return parseStripeConfig((await deps.store.get())["stripe"]);
}

export async function getStripe(deps: StripeDeps): Promise<{ stripe: Stripe; cfg: StripePluginConfig }> {
  const cfg = await readStripeConfig(deps);
  if (!cfg.installed || !cfg.secretKey || !cfg.accountId || !isEnvelope(cfg.secretKey)) throw new StripeNotConfiguredError("not connected");
  const mk = deps.masterKey();
  if (!mk) throw new StripeNotConfiguredError("INTEGRATIONS_ENCRYPTION_KEY missing");
  const k = `${cfg.accountId}:${cfg.secretKey.ct}`;
  let stripe = cache.get(k);
  if (!stripe) {
    let secret: string;
    try { secret = open(cfg.secretKey, mk, "stripe.secretKey"); } catch { throw new StripeNotConfiguredError("stored key cannot be decrypted"); }
    stripe = createStripeClient(secret);
    cache.set(k, stripe);
  }
  return { stripe, cfg };
}

export async function getWebhookSecret(deps: StripeDeps): Promise<string> {
  const cfg = await readStripeConfig(deps);
  const mk = deps.masterKey();
  if (!cfg.webhookSecret || !mk) throw new StripeNotConfiguredError("webhook secret missing");
  try { return open(cfg.webhookSecret, mk, "stripe.webhookSecret"); } catch { throw new StripeNotConfiguredError("webhook secret cannot be decrypted"); }
}
