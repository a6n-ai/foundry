import { awsConfigFromEnv, createAwsClient, type AwsConfig } from "@foundry/aws";
import type { MapAsset, MapTileProvider } from "./types";

export interface AwsMapOptions extends AwsConfig {
  style?: "Standard";
  colorScheme?: "Light" | "Dark";
  tileset?: string;
  variant?: string;
}

const BUDGET = { retries: 1, timeoutMs: 6_000 };

// Same encoder as @foundry/aws; aws4fetch decodes then re-encodes the path, so a single pass is stable.
const seg = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function awsMapProvider(opts: AwsMapOptions = {}): MapTileProvider {
  const env = awsConfigFromEnv();
  const client = createAwsClient("geo-maps", {
    region: opts.region ?? env.region,
    credentials: opts.credentials ?? env.credentials,
    fetch: opts.fetch,
  });
  const style = opts.style ?? "Standard";
  const scheme = opts.colorScheme ?? "Light";
  const tileset = opts.tileset ?? "vector.basemap";
  const variant = opts.variant ?? "Default";
  // client.region throws MissingRegion, so resolve it per call.
  const get = async (path: string, query?: Record<string, string>): Promise<MapAsset> => {
    const res = await client.request(`https://maps.geo.${client.region}.amazonaws.com${path}`, { query, ...BUDGET });
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? undefined };
  };

  return {
    id: "aws",
    style: () => get(`/v2/styles/${seg(style)}/descriptor`, { "color-scheme": scheme }),
    tile: (z, x, y) => get(`/v2/tiles/${seg(tileset)}/${seg(z)}/${seg(x)}/${seg(y)}`),
    sprite: (file) => get(`/v2/styles/${seg(style)}/${seg(scheme)}/${seg(variant)}/sprites/${seg(file)}`),
    glyphs: (fontStack, range) => get(`/v2/glyphs/${seg(fontStack)}/${seg(range)}`),
  };
}
