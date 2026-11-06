import { AwsError, awsConfigFromEnv, createAwsClient, encodePathSegment as seg, type AwsConfig } from "@foundry/cloud";
import type { MapAsset, MapTileProvider } from "./types";

export interface AwsMapOptions extends AwsConfig {
  style?: "Standard";
  colorScheme?: "Light" | "Dark";
  tileset?: string;
  variant?: string;
}

const check = (value: string, re: RegExp, what: string) => {
  if (!re.test(value)) throw new AwsError("InvalidPathSegment", `Invalid ${what}: ${JSON.stringify(value)}`);
  return value;
};

const BUDGET = { retries: 1, timeoutMs: 6_000 };

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
    tile: async (z, x, y) =>
      get(`/v2/tiles/${seg(tileset)}/${check(z, /^\d{1,2}$/, "z")}/${check(x, /^\d{1,7}$/, "x")}/${check(y, /^\d{1,7}$/, "y")}`),
    sprite: async (file) =>
      get(`/v2/styles/${seg(style)}/${seg(scheme)}/${seg(variant)}/sprites/${seg(check(file, /^sprites(@2x)?\.(png|json)$/, "sprite file"))}`),
    glyphs: async (fontStack, range) =>
      get(`/v2/glyphs/${seg(fontStack)}/${check(range, /^\d{1,6}-\d{1,6}\.pbf$/, "glyph range")}`),
  };
}
