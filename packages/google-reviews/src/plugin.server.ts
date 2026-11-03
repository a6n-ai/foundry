import type { IntegrationsConfigStore, PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import { GOOGLE_REVIEWS_PLUGIN_ID } from "./plugin";
import { googleReviewsSlice } from "./store";

export function googleReviewsPlugin(store: IntegrationsConfigStore): PluginServer {
  return slicePlugin({
    id: GOOGLE_REVIEWS_PLUGIN_ID,
    slice: googleReviewsSlice(store),
    statusLabel: (cfg) => (cfg.placeId ? "Installed" : "Installed · needs a Place ID"),
  });
}
