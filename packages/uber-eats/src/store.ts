import type { IntegrationsConfigStore } from "@foundry/commons/plugin";
import { integrationSlice } from "@foundry/commons/plugin-kit";
import { uberEatsConfigSchema, DEFAULT_UBER_EATS_CONFIG, parseUberEatsConfig, type UberEatsConfig } from "./config";
import { UBER_EATS_PLUGIN_ID } from "./plugin";

export async function getUberEatsConfig(store: IntegrationsConfigStore): Promise<UberEatsConfig> {
  const cfg = await store.get();
  const raw = (cfg as Record<string, unknown>)[UBER_EATS_PLUGIN_ID];
  return raw ? parseUberEatsConfig(raw) : { ...DEFAULT_UBER_EATS_CONFIG };
}

export async function setUberEatsConfig(
  store: IntegrationsConfigStore,
  next: UberEatsConfig,
): Promise<void> {
  const cfg = await store.get();
  await store.set({ ...cfg, [UBER_EATS_PLUGIN_ID]: parseUberEatsConfig(next) });
}

export async function installUberEats(store: IntegrationsConfigStore): Promise<void> {
  await uberEatsSlice(store).update({ installed: true });
}

/** Keeps the url so a reinstall does not force re-entering it. */
export async function uninstallUberEats(store: IntegrationsConfigStore): Promise<void> {
  await uberEatsSlice(store).update({ installed: false });
}

/** Install/uninstall merge into this key; the rest of the config survives an uninstall. */
export const uberEatsSlice = (store: IntegrationsConfigStore) => integrationSlice(UBER_EATS_PLUGIN_ID, uberEatsConfigSchema, { store });
