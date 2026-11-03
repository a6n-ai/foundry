import type { IntegrationsConfigStore, PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import { UBER_EATS_PLUGIN_ID } from "./plugin";
import { uberEatsSlice } from "./store";

export function uberEatsPlugin(store: IntegrationsConfigStore): PluginServer {
  return slicePlugin({
    id: UBER_EATS_PLUGIN_ID,
    slice: uberEatsSlice(store),
    statusLabel: (cfg) => (cfg.url ? "Installed" : "Installed · needs a store URL"),
  });
}
