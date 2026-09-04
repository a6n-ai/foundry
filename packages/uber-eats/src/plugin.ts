import { ExternalLinkIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";

/**
 * Client-safe Uber Eats plugin catalog metadata.
 * No secrets, no fetch — safe for Integrations UI and settings hubs.
 */
export const UBER_EATS_PLUGIN_ID = "uberEats" as const;

export const UBER_EATS_PLUGIN = {
  id: UBER_EATS_PLUGIN_ID,
  label: "Uber Eats",
  description: "Link the public site to this client's Uber Eats storefront.",
} as const;

/** Client-safe catalog metadata for the plugin registry. Mirrors @foundry/google-reviews's GOOGLE_REVIEWS_PLUGIN_META. */
export const UBER_EATS_PLUGIN_META: PluginMeta = {
  id: UBER_EATS_PLUGIN.id,
  label: UBER_EATS_PLUGIN.label,
  description: UBER_EATS_PLUGIN.description,
  icon: ExternalLinkIcon,
  settingsHref: "/dashboard/settings/uber-eats",
};
