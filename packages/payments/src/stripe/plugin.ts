import { CreditCardIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";

export const STRIPE_PLUGIN: PluginMeta = {
  id: "stripe",
  label: "Stripe",
  description: "Card, Apple Pay and Google Pay. Stripe Tax and an optional credit-card surcharge.",
  icon: CreditCardIcon,
  settingsHref: "/dashboard/settings/payments/stripe",
};
