import type { IntegrationsConfigStore, PluginServer, PluginStatus } from "@foundry/commons/plugin";
import { UBER_EATS_PLUGIN_ID } from "./plugin";
import { getUberEatsConfig, installUberEats, uninstallUberEats } from "./store";

export function uberEatsPlugin(store: IntegrationsConfigStore): PluginServer {
  return {
    id: UBER_EATS_PLUGIN_ID,

    async status(): Promise<PluginStatus> {
      const cfg = await getUberEatsConfig(store);
      if (!cfg.installed) return { installed: false };
      return {
        installed: true,
        statusLabel: cfg.url ? "Installed" : "Installed · needs a store URL",
      };
    },

    install: () => installUberEats(store),
    uninstall: () => uninstallUberEats(store),
  };
}
