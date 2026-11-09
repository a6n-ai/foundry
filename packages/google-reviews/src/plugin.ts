import { StarIcon } from "lucide-react";
import type { PluginMeta } from "@foundry/commons/plugin";
import { LOGO } from "./logo";

export const GOOGLE_REVIEWS_PLUGIN_ID = "googleReviews" as const;

export const GOOGLE_REVIEWS_PLUGIN = {
  id: GOOGLE_REVIEWS_PLUGIN_ID,
  label: "Google Reviews",
  description:
    "Show real Google ratings and reviews on the public site, and invite customers to leave one.",
} as const;

export const GOOGLE_REVIEWS_PLUGIN_META: PluginMeta = {
  id: GOOGLE_REVIEWS_PLUGIN.id,
  label: GOOGLE_REVIEWS_PLUGIN.label,
  description: GOOGLE_REVIEWS_PLUGIN.description,
  icon: StarIcon,
  settingsHref: "/dashboard/settings/google-reviews",
  category: "Marketing",
  tone: "amber",
  logo: LOGO,
};
