import type { PluginServer } from "@foundry/commons/plugin";
import { parseStripeConfig } from "./config";
import { disconnectStripe, type ConnectDeps } from "./connect";

export function stripePlugin(deps: ConnectDeps): PluginServer {
  return {
    id: "stripe",
    requires: ["payments"],
    async status() {
      const cfg = parseStripeConfig((await deps.store.get())["stripe"]);
      const connected = cfg.installed && !!cfg.accountId;
      return {
        installed: cfg.installed,
        statusLabel: connected ? `Connected · ${cfg.livemode ? "Live" : "Test"}` : cfg.installed ? "Installed · not connected" : undefined,
      };
    },
    // Install only reveals the settings tab; connecting happens there with the keys.
    async install() {
      const blob = await deps.store.get();
      await deps.store.set({ ...blob, stripe: { ...parseStripeConfig(blob["stripe"]), installed: true } });
    },
    uninstall: () => disconnectStripe(deps),
  };
}
