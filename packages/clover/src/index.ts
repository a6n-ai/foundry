/**
 * @foundry/clover — Clover Platform + Ecommerce integration.
 *
 * Server-only. App secret and OAuth tokens must never reach the client.
 * Only the names tiffin-grab and xplorers import are exported; reach into
 * the module files for anything else.
 */

export {
  cloverApiTokenConnectSchema,
  parseIntegrationsConfig,
  toPublicCloverConnection,
  loadCloverAppCredentialsFromEnv,
  type CloverApiTokenConnectInput,
  type CloverApiTokenConnectResult,
  type IntegrationsConfig,
} from "./config";

export {
  buildCloverAuthorizeUrl,
  parseCloverOAuthCallback,
  exchangeCloverAuthorizationCode,
} from "./oauth";

export { verifyCloverApiToken } from "./create-client";

export { CloverApiClient } from "./client";

export {
  getCloverConnection,
  setCloverConnection,
  installCloverPlugin,
  connectCloverWithApiToken,
  disconnectClover,
  type IntegrationsConfigStore,
} from "./store";
