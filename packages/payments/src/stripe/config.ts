import { z } from "zod";

export const STRIPE_PLUGIN_ID = "stripe" as const;
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
export const SURCHARGE_MAX_PCT = 2.4;

const envelope = z.object({ v: z.literal(1), iv: z.string(), tag: z.string(), ct: z.string() });

export const stripePluginConfigSchema = z.object({
  installed: z.boolean().default(false),
  secretKey: envelope.optional(),
  secretKeyHint: z.string().optional(), // "rk_live_…a1b2" — display only
  publishableKey: z.string().optional(),
  webhookEndpointId: z.string().optional(),
  webhookSecret: envelope.optional(),
  accountId: z.string().optional(),
  livemode: z.boolean().optional(),
  connectedAt: z.number().optional(),
  lastEventAt: z.number().optional(),
  methodLabel: z.string().default("Card"),
  tax: z.object({
    enabled: z.boolean().default(false),
    taxCode: z.string().optional(),
    surchargeTaxable: z.boolean().default(false),
  }).default({ enabled: false, surchargeTaxable: false }),
  surcharge: z.object({
    enabled: z.boolean().default(false),
    ratePct: z.number().min(0).default(0),
    excludeProvinces: z.array(z.string()).default(["QC"]),
    networksNotifiedOn: z.string().optional(),
  }).default({ enabled: false, ratePct: 0, excludeProvinces: ["QC"] }),
});
export type StripePluginConfig = z.infer<typeof stripePluginConfigSchema>;

export function parseStripeConfig(raw: unknown): StripePluginConfig {
  const parsed = stripePluginConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : stripePluginConfigSchema.parse({});
}

export function keyMode(key: string): "test" | "live" | null {
  const m = /^(?:rk|sk|pk)_(test|live)_/.exec(key);
  return m ? (m[1] as "test" | "live") : null;
}

export function stripeKeysError(secret: string, publishable: string): string | null {
  if (!/^(rk|sk)_/.test(secret)) return "Paste a secret or restricted key (rk_… recommended)";
  if (!publishable.startsWith("pk_")) return "Paste the publishable key (pk_…)";
  const a = keyMode(secret);
  const b = keyMode(publishable);
  if (!a || !b) return "Unrecognised key format";
  if (a !== b) return "Both keys must be from the same mode (test or live)";
  return null;
}

export function stripeConfigSaveError(cfg: StripePluginConfig): string | null {
  const s = cfg.surcharge;
  if (s.enabled) {
    if (!s.networksNotifiedOn) return "Record the date card networks were notified before enabling a surcharge";
    if (s.ratePct <= 0 || s.ratePct > SURCHARGE_MAX_PCT) return `Surcharge must be between 0 and ${SURCHARGE_MAX_PCT}%`;
  }
  if (cfg.tax.enabled && !cfg.tax.taxCode) return "Pick a tax code before enabling Stripe Tax";
  return null;
}

export function secretHint(secret: string): string {
  return `${secret.slice(0, 8)}…${secret.slice(-4)}`;
}
