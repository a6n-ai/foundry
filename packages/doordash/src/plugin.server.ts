import type { IntegrationsConfigStore, PluginServer, PluginStatus } from "@foundry/commons/plugin";
import { DOORDASH_PLUGIN_ID } from "./plugin";
import { getDoorDashConfig, installDoorDash, uninstallDoorDash } from "./store";

export function doorDashPlugin(store: IntegrationsConfigStore): PluginServer {
  return {
    id: DOORDASH_PLUGIN_ID,

    async status(): Promise<PluginStatus> {
      const cfg = await getDoorDashConfig(store);
      if (!cfg.installed) return { installed: false };
      return {
        installed: true,
        statusLabel: cfg.url ? "Installed" : "Installed · needs a store URL",
      };
    },

    install: () => installDoorDash(store),
    uninstall: () => uninstallDoorDash(store),
  };
}
