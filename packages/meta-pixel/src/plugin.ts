import { MegaphoneIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";
import { LOGO } from "./logo";

export const META_PIXEL_PLUGIN_ID = "meta-pixel" as const;
/** Config key in the integrations blob (kept from the app-local version so saved settings carry over). */
export const META_PIXEL_KEY = "metaPixel" as const;
export const META_PIXEL_SETTINGS_HREF = "/dashboard/settings/meta-pixel";

/** Client-safe catalog metadata. */
export const META_PIXEL_PLUGIN_META: PluginMeta = {
  id: META_PIXEL_PLUGIN_ID,
  label: "Meta Pixel",
  description: "Facebook and Instagram ad tracking: browser pixel plus Conversions API.",
  icon: MegaphoneIcon,
  settingsHref: META_PIXEL_SETTINGS_HREF,
  category: "Marketing",
  tone: "blue",
  logo: LOGO,
};
