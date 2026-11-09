import { z } from "zod";
import { envelopeSchema, integrationSlice, type SliceStores } from "@foundry/commons/plugin-kit";
import { sealedSecret } from "@foundry/commons/secret-box";
import { GA_ID_RE } from "./ids";
import { GA_KEY } from "./plugin";

export const gaConfigSchema = z.object({
  installed: z.boolean().default(false),
  measurementId: z.string().regex(GA_ID_RE).nullable().default(null),
  /** Measurement Protocol API secret, for server events. Sealed under the app's master key. */
  apiSecret: envelopeSchema.nullable().default(null),
});
export type GaConfig = z.infer<typeof gaConfigSchema>;

export type GaStatus = {
  installed: boolean;
  measurementId: string | null;
  envMeasurementId: string | null;
  hasSecret: boolean;
  secretReadable: boolean;
  hasEncryptionKey: boolean;
};

export type GaConnection = { measurementId: string; apiSecret: string };

export type GoogleAnalyticsDeps = SliceStores & {
  masterKey: () => string | null | undefined;
  /** A pre-plugin measurement ID (e.g. from env), used until the plugin is installed and copied in on install. */
  legacyMeasurementId?: () => string | null | undefined;
};

export function createGoogleAnalytics(deps: GoogleAnalyticsDeps) {
  const slice = integrationSlice(GA_KEY, gaConfigSchema, deps);
  const apiSecret = sealedSecret("googleAnalytics.apiSecret", deps.masterKey);
  const openApiSecret = (cfg: GaConfig) => apiSecret.open(cfg.apiSecret);
  const legacyId = (): string | null => {
    const id = deps.legacyMeasurementId?.()?.trim();
    return id && GA_ID_RE.test(id) ? id : null;
  };

  return {
    slice,
    apiSecret,
    getConfig: slice.get,
    update: slice.update,
    openApiSecret,
    legacyMeasurementId: legacyId,
    effectiveMeasurementId: (cfg: GaConfig): string | null => (cfg.installed ? cfg.measurementId : legacyId()),

    async status(): Promise<GaStatus> {
      const cfg = await slice.get();
      return {
        installed: cfg.installed,
        measurementId: cfg.measurementId,
        envMeasurementId: legacyId(),
        hasSecret: cfg.apiSecret != null,
        secretReadable: openApiSecret(cfg) != null,
        hasEncryptionKey: apiSecret.hasKey(),
      };
    },

    /** Null until installed with an ID and a readable secret: server events are then skipped. */
    async connection(): Promise<GaConnection | null> {
      const cfg = await slice.get();
      if (!cfg.installed || !cfg.measurementId) return null;
      const secret = openApiSecret(cfg);
      return secret ? { measurementId: cfg.measurementId, apiSecret: secret } : null;
    },
  };
}
export type GoogleAnalytics = ReturnType<typeof createGoogleAnalytics>;
