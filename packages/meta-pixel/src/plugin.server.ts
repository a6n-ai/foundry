import type { PluginServer } from "@foundry/commons/plugin";
import { slicePlugin } from "@foundry/commons/plugin-kit";
import type { MetaPixel } from "./config";
import { META_PIXEL_PLUGIN_ID } from "./plugin";

export function metaPixelPlugin(meta: MetaPixel): PluginServer {
  return slicePlugin({
    id: META_PIXEL_PLUGIN_ID,
    slice: meta.slice,
    statusLabel: (c) =>
      !c.pixelId ? "Missing pixel ID" : c.testEventCode ? "Test mode" : meta.openAccessToken(c) ? "Connected" : "Browser only",
  });
}
