import { ExternalLinkIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";

/**
 * Client-safe DoorDash plugin catalog metadata.
 * No secrets, no fetch — safe for Integrations UI and settings hubs.
 */
export const DOORDASH_PLUGIN_ID = "doorDash" as const;

export const DOORDASH_PLUGIN = {
  id: DOORDASH_PLUGIN_ID,
  label: "DoorDash",
  description: "Link the public site to this client's DoorDash storefront.",
} as const;

/** Client-safe catalog metadata for the plugin registry. Mirrors @foundry/uber-eats's UBER_EATS_PLUGIN_META. */
export const DOORDASH_PLUGIN_META: PluginMeta = {
  id: DOORDASH_PLUGIN.id,
  label: DOORDASH_PLUGIN.label,
  description: DOORDASH_PLUGIN.description,
  icon: ExternalLinkIcon,
  settingsHref: "/dashboard/settings/doordash",
};
