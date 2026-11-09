import { ChartLineIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";
import { LOGO } from "./logo";

export const GA_PLUGIN_ID = "google-analytics" as const;
/** Config key in the integrations blob (kept from the app-local version so saved settings carry over). */
export const GA_KEY = "googleAnalytics" as const;
export const GA_SETTINGS_HREF = "/dashboard/settings/google-analytics";

export const GA_PLUGIN_META: PluginMeta = {
  id: GA_PLUGIN_ID,
  label: "Google Analytics",
  description: "GA4 visitors, traffic sources, and conversions, with server-side purchases.",
  icon: ChartLineIcon,
  settingsHref: GA_SETTINGS_HREF,
  category: "Marketing",
  tone: "orange",
  logo: LOGO,
};
