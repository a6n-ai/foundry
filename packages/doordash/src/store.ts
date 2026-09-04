import type { IntegrationsConfigStore } from "@foundry/commons/plugin";
import { DEFAULT_DOORDASH_CONFIG, parseDoorDashConfig, type DoorDashConfig } from "./config";
import { DOORDASH_PLUGIN_ID } from "./plugin";

export async function getDoorDashConfig(store: IntegrationsConfigStore): Promise<DoorDashConfig> {
  const cfg = await store.get();
  const raw = (cfg as Record<string, unknown>)[DOORDASH_PLUGIN_ID];
  return raw ? parseDoorDashConfig(raw) : { ...DEFAULT_DOORDASH_CONFIG };
}

export async function setDoorDashConfig(
  store: IntegrationsConfigStore,
  next: DoorDashConfig,
): Promise<void> {
  const cfg = await store.get();
  await store.set({ ...cfg, [DOORDASH_PLUGIN_ID]: parseDoorDashConfig(next) });
}

export async function installDoorDash(store: IntegrationsConfigStore): Promise<void> {
  const current = await getDoorDashConfig(store);
  await setDoorDashConfig(store, { ...current, installed: true });
}

/** Keeps the url so a reinstall does not force re-entering it. */
export async function uninstallDoorDash(store: IntegrationsConfigStore): Promise<void> {
  const current = await getDoorDashConfig(store);
  await setDoorDashConfig(store, { ...current, installed: false });
}
