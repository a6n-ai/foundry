import { cloverConnectionSchema } from "./config";
import type {
  CloverApiTokenConnectInput,
  CloverConnection,
  IntegrationsConfig,
} from "./config";
import type { IntegrationsConfigStore as BaseStore } from "@foundry/commons/plugin";
import { integrationSlice } from "@foundry/commons/plugin-kit";
import { CLOVER_PLUGIN_ID } from "./plugin";

export type IntegrationsConfigStore = BaseStore<IntegrationsConfig>;

export const cloverSlice = (store: IntegrationsConfigStore) =>
  integrationSlice(CLOVER_PLUGIN_ID, cloverConnectionSchema, { store });

export const getCloverConnection = (store: IntegrationsConfigStore): Promise<CloverConnection> =>
  cloverSlice(store).get();

export const setCloverConnection = (
  store: IntegrationsConfigStore,
  clover: CloverConnection,
): Promise<void> => store.get().then((cfg) => store.set({ ...cfg, clover }));

export const installCloverPlugin = (store: IntegrationsConfigStore): Promise<void> =>
  cloverSlice(store).update({ installed: true });

/**
 * Connect a merchant with a permanent API token from their Clover dashboard
 * (Setup → API Tokens) instead of the developer-app OAuth flow.
 * Callers must verify the token against the Clover API before persisting.
 * No webhooks in this mode — Clover only delivers those to a registered app.
 */
export async function connectCloverWithApiToken(
  store: IntegrationsConfigStore,
  input: CloverApiTokenConnectInput,
): Promise<void> {
  const current = await getCloverConnection(store);
  await setCloverConnection(store, {
    ...current,
    installed: true,
    connected: true,
    authMode: "apiToken",
    merchantId: input.merchantId,
    apiToken: input.apiToken,
    ecommercePublicKey: input.ecommercePublicKey,
    ecommercePrivateToken: input.ecommercePrivateToken,
    environment: input.environment,
    region: input.region,
    tokens: undefined,
    connectedAt: new Date().toISOString(),
  });
}

/**
 * Persist which Clover order type website orders should carry.
 *
 * Read-modify-write through getCloverConnection so this never clobbers tokens or
 * the merchant id — the same reason every other mutation here spreads `current`.
 */
export async function setCloverWebOrderTypes(
  store: IntegrationsConfigStore,
  webOrderTypes: { pickup?: string; delivery?: string },
): Promise<void> {
  const current = await getCloverConnection(store);
  await setCloverConnection(store, { ...current, webOrderTypes });
}

export async function disconnectClover(store: IntegrationsConfigStore): Promise<void> {
  const current = await getCloverConnection(store);
  await setCloverConnection(store, {
    ...current,
    connected: false,
    authMode: "oauth",
    merchantId: undefined,
    tokens: undefined,
    apiToken: undefined,
    ecommercePublicKey: undefined,
    ecommercePrivateToken: undefined,
    connectedAt: undefined,
  });
}
