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
  /**
   * Meta webhook verify token for Instant Forms leadgen (plain; matched on hub.verify_token).
   * Set the same value in Meta App → Webhooks.
   */
  leadgenVerifyToken: z.string().min(8).max(128).nullable().default(null),
  /** Page access token with leads_retrieval — used to GET /{lead_id}. Sealed. */
  pageAccessToken: envelopeSchema.nullable().default(null),
  /** Meta App secret for X-Hub-Signature-256 on leadgen POSTs. Sealed. */
  appSecret: envelopeSchema.nullable().default(null),
});
export type MetaPixelConfig = z.infer<typeof metaPixelConfigSchema>;

export type MetaConnection = { pixelId: string; token: string; testEventCode: string | null };

/** Safe for an admin UI: never carries secrets. */
export type MetaPixelStatus = {
  installed: boolean;
  pixelId: string | null;
  hasToken: boolean;
  tokenReadable: boolean;
  testEventCode: string | null;
  hasEncryptionKey: boolean;
  leadgenVerifyTokenSet: boolean;
  hasPageAccessToken: boolean;
  pageAccessTokenReadable: boolean;
  hasAppSecret: boolean;
  appSecretReadable: boolean;
};

export type MetaLeadgenConnection = {
  verifyToken: string;
  pageAccessToken: string;
  appSecret: string | null;
};

export type MetaPixelDeps = SliceStores & {
  masterKey: () => string | null | undefined;
};

export function createMetaPixel(deps: MetaPixelDeps) {
  const slice = integrationSlice(META_PIXEL_KEY, metaPixelConfigSchema, deps);
  const accessToken = sealedSecret("metaPixel.accessToken", deps.masterKey);
  const pageAccessToken = sealedSecret("metaPixel.pageAccessToken", deps.masterKey);
  const appSecret = sealedSecret("metaPixel.appSecret", deps.masterKey);
  const openAccessToken = (cfg: MetaPixelConfig) => accessToken.open(cfg.accessToken);
  const openPageAccessToken = (cfg: MetaPixelConfig) => pageAccessToken.open(cfg.pageAccessToken);
  const openAppSecret = (cfg: MetaPixelConfig) => appSecret.open(cfg.appSecret);

  return {
    slice,
    accessToken,
    pageAccessToken,
    appSecret,
    getConfig: slice.get,
    update: slice.update,
    openAccessToken,
    openPageAccessToken,
    openAppSecret,

    async status(): Promise<MetaPixelStatus> {
      const cfg = await slice.get();
      return {
        installed: cfg.installed,
        pixelId: cfg.pixelId,
        hasToken: cfg.accessToken != null,
        tokenReadable: openAccessToken(cfg) != null,
        testEventCode: cfg.testEventCode,
        hasEncryptionKey: accessToken.hasKey(),
        leadgenVerifyTokenSet: Boolean(cfg.leadgenVerifyToken?.trim()),
        hasPageAccessToken: cfg.pageAccessToken != null,
        pageAccessTokenReadable: openPageAccessToken(cfg) != null,
        hasAppSecret: cfg.appSecret != null,
        appSecretReadable: openAppSecret(cfg) != null,
      };
    },

    /** Null until installed with a pixel ID and a readable token: callers then skip the send. */
    async connection(): Promise<MetaConnection | null> {
      const cfg = await slice.get();
      if (!cfg.installed || !cfg.pixelId) return null;
      const token = openAccessToken(cfg);
      return token ? { pixelId: cfg.pixelId, token, testEventCode: cfg.testEventCode } : null;
    },

    /** Null until verify token + readable page access token are saved (app secret optional but recommended). */
    async leadgenConnection(): Promise<MetaLeadgenConnection | null> {
      const cfg = await slice.get();
      const verifyToken = cfg.leadgenVerifyToken?.trim() || "";
      const pageToken = openPageAccessToken(cfg);
      if (!verifyToken || !pageToken) return null;
      return {
        verifyToken,
        pageAccessToken: pageToken,
        appSecret: openAppSecret(cfg),
      };
    },
  };
}
export type MetaPixel = ReturnType<typeof createMetaPixel>;
