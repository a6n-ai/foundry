import { BanknoteIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";

export const PAYMENTS_PLUGIN_ID = "payments" as const;

/** Client-safe catalog metadata. No secrets, no fetch, no store. */
export const PAYMENTS_PLUGIN: PluginMeta = {
  id: PAYMENTS_PLUGIN_ID,
  label: "Payments",
  description:
    "Accept payments. Cash on delivery is on by default. Card payments come later via Stripe as a provider, not a second plugin.",
  icon: BanknoteIcon,
  settingsHref: "/dashboard/settings/payments",
};
