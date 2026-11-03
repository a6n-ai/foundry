import type { PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import type { GoogleAnalytics } from "./config";
import { GA_PLUGIN_ID } from "./plugin";

export function googleAnalyticsPlugin(ga: GoogleAnalytics): PluginServer {
  return slicePlugin({
    id: GA_PLUGIN_ID,
    slice: ga.slice,
    statusLabel: (c) => (!c.measurementId ? "Missing measurement ID" : ga.openApiSecret(c) ? "Connected" : "Browser only"),
    // First install carries the legacy ID over so the site never goes untracked in between.
    onInstall: (c) => ({ measurementId: c.measurementId ?? ga.legacyMeasurementId() }),
  });
}
