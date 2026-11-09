import type { PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import { DEFAULT_CLOVER_CONNECTION } from "./config";
import { CLOVER_PLUGIN, cloverNavSections } from "./plugin";
import { cloverSlice } from "./store";
import type { IntegrationsConfigStore } from "./store";

export function cloverPlugin(store: IntegrationsConfigStore): PluginServer {
  return slicePlugin({
    id: CLOVER_PLUGIN.id,
    slice: cloverSlice(store),
    statusLabel: (cfg) => (cfg.connected ? "Connected" : "Installed"),
    // Removing the plugin clears tokens: the merchant must reconnect after reinstall.
    onUninstall: () => ({
      ...DEFAULT_CLOVER_CONNECTION,
      merchantId: undefined,
      tokens: undefined,
      apiToken: undefined,
      ecommercePublicKey: undefined,
      ecommercePrivateToken: undefined,
      webOrderTypes: undefined,
      connectedAt: undefined,
    }),
    nav: cloverNavSections,
  });
}
