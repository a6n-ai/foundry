import { z } from "zod";
import { envelopeSchema, integrationSlice, type SliceStores } from "@foundry/commons/plugin-kit";
import { sealedSecret } from "@foundry/commons/secret-box";
import { PIXEL_ID_RE, TEST_CODE_RE } from "./ids";
import { META_PIXEL_KEY } from "./plugin";

export const metaPixelConfigSchema = z.object({
  installed: z.boolean().default(false),
  pixelId: z.string().regex(PIXEL_ID_RE).nullable().default(null),
  /** Conversions API access token, sealed under the app's master key. */
  accessToken: envelopeSchema.nullable().default(null),
  /** Events Manager → Test events code. Server events sent with it land in Test events, so clear it after testing. */
  testEventCode: z.string().regex(TEST_CODE_RE).nullable().default(null),
});
export type MetaPixelConfig = z.infer<typeof metaPixelConfigSchema>;

export type MetaConnection = { pixelId: string; token: string; testEventCode: string | null };

/** Safe for an admin UI: never carries the token. */
export type MetaPixelStatus = {
  installed: boolean;
  pixelId: string | null;
  hasToken: boolean;
  tokenReadable: boolean;
  testEventCode: string | null;
  hasEncryptionKey: boolean;
};

export type MetaPixelDeps = SliceStores & {
  /** The app's integrations master key (e.g. INTEGRATIONS_ENCRYPTION_KEY). */
  masterKey: () => string | null | undefined;
};

/** One app's Meta Pixel: config slice, sealed token, and the connection the CAPI sender needs. */
export function createMetaPixel(deps: MetaPixelDeps) {
  const slice = integrationSlice(META_PIXEL_KEY, metaPixelConfigSchema, deps);
  const accessToken = sealedSecret("metaPixel.accessToken", deps.masterKey);
  const openAccessToken = (cfg: MetaPixelConfig) => accessToken.open(cfg.accessToken);

  return {
    slice,
    accessToken,
    getConfig: slice.get,
    update: slice.update,
    openAccessToken,

    async status(): Promise<MetaPixelStatus> {
      const cfg = await slice.get();
      return {
        installed: cfg.installed,
        pixelId: cfg.pixelId,
        hasToken: cfg.accessToken != null,
        tokenReadable: openAccessToken(cfg) != null,
        testEventCode: cfg.testEventCode,
        hasEncryptionKey: accessToken.hasKey(),
      };
    },

    /** Null until installed with a pixel ID and a readable token: callers then skip the send. */
    async connection(): Promise<MetaConnection | null> {
      const cfg = await slice.get();
      if (!cfg.installed || !cfg.pixelId) return null;
      const token = openAccessToken(cfg);
      return token ? { pixelId: cfg.pixelId, token, testEventCode: cfg.testEventCode } : null;
    },
  };
}
export type MetaPixel = ReturnType<typeof createMetaPixel>;
