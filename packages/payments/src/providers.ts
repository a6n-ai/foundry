import type { LucideIcon } from "lucide-react";
import { BanknoteIcon, HandCoinsIcon } from "lucide-react";
import type { PaymentConfig, PaymentMethodConfig } from "./config";

/**
 * A payment provider inside the Payments plugin (Settings → Payments).
 * Providers are NOT Integrations cards — Payments is the single plugin.
 *
 * Card / Stripe is an online rail that plugs in later via `kind: "online"`.
 * It is not in this catalog and must not appear as a method tab.
 */
export type PaymentProviderDef = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Plugin id that must be installed for this provider to be available,
   * e.g. "clover" for the Clover Payment provider. Unused by the manual
   * providers; first consumer lands with Clover Payment.
   */
  requiresPlugin?: string;
  /** Seed row written into payment_config when the provider is installed. */
  seed: () => PaymentMethodConfig;
};

export const PAYMENT_PROVIDERS: readonly PaymentProviderDef[] = [
  {
    id: "cash",
    label: "Cash on delivery",
    description: "Collect cash at the door; optional photo proof on claim.",
    icon: HandCoinsIcon,
    seed: () => ({
      id: "cash",
      kind: "manual",
      enabled: true,
      label: "Cash on delivery",
      taxes: [],
    }),
  },
  {
    id: "etransfer",
    label: "Interac e-Transfer",
    description: "Customers send an e-Transfer; staff verifies the claim.",
    icon: BanknoteIcon,
    seed: () => ({
      id: "etransfer",
      kind: "manual",
      enabled: false,
      label: "Interac e-Transfer",
      taxes: [],
    }),
  },
];

export function findPaymentProvider(id: string): PaymentProviderDef | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}

/** Fill in missing catalog methods. Cash is seeded enabled; extras (legacy manual) stay. */
export function mergePaymentCatalog(cfg: PaymentConfig): PaymentConfig {
  const byId = new Map(cfg.methods.map((m) => [m.id, m]));
  const methods: PaymentMethodConfig[] = PAYMENT_PROVIDERS.map((p) => byId.get(p.id) ?? p.seed());
  for (const m of cfg.methods) {
    if (!findPaymentProvider(m.id)) methods.push(m);
  }
  const unchanged =
    methods.length === cfg.methods.length && methods.every((m, i) => m === cfg.methods[i]);
  return unchanged ? cfg : { ...cfg, methods };
}
