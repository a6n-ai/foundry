import type { IntegrationsConfigStore, PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import { DOORDASH_PLUGIN_ID } from "./plugin";
import { doorDashSlice } from "./store";

export function doorDashPlugin(store: IntegrationsConfigStore): PluginServer {
  return slicePlugin({
    id: DOORDASH_PLUGIN_ID,
    slice: doorDashSlice(store),
    statusLabel: (cfg) => (cfg.url ? "Installed" : "Installed · needs a store URL"),
  });
}
