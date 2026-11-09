import { z } from "zod";
import type { IntegrationsConfigStore, PluginServer, PluginStatus } from "./plugin";

/**
 * Shared plumbing for config-backed plugins. Each plugin owns one key of the app's
 * integrations config blob (parsed `.loose()` app-side, so keys coexist and a new plugin
 * needs no migration), and every one installs, uninstalls and reports status the same way.
 */

export const envelopeSchema = z.object({ v: z.literal(1), iv: z.string(), tag: z.string(), ct: z.string() });

type Installable = { installed: boolean };

export type SliceStores = {
  /** Uncached store, used for every read-modify-write. */
  store: IntegrationsConfigStore;
  /** Optional cached store for hot reads (public scripts, event sends). Defaults to `store`. */
  readStore?: IntegrationsConfigStore;
};

export type IntegrationSlice<T extends Installable> = {
  key: string;
  /** Unknown or invalid input falls back to the schema defaults, never throws. */
  parse(raw: unknown): T;
  get(): Promise<T>;
  /** Merges into the current value read from the uncached store, so a stale copy never resurrects a key wiped elsewhere. */
  update(patch: Partial<T>): Promise<void>;
};

export function integrationSlice<S extends z.ZodType<Installable>>(
  key: string,
  schema: S,
  { store, readStore = store }: SliceStores,
): IntegrationSlice<z.infer<S>> {
  type T = z.infer<S>;
  const fallback = schema.parse({}) as T;
  const parse = (raw: unknown): T => {
    const parsed = schema.safeParse(raw ?? {});
    return parsed.success ? (parsed.data as T) : { ...fallback };
  };
  const pick = (cfg: unknown) => parse((cfg as Record<string, unknown>)[key]);
  return {
    key,
    parse,
    get: async () => pick(await readStore.get()),
    async update(patch) {
      const cfg = await store.get();
      await store.set({ ...cfg, [key]: schema.parse({ ...pick(cfg), ...patch }) });
    },
  };
}

/**
 * The PluginServer every config-backed plugin shares: `installed` is a flag in its slice, and
 * uninstall keeps the rest of the config, so reinstalling (or a marketplace Undo) restores it whole.
 */
export function slicePlugin<T extends Installable>(opts: {
  id: string;
  slice: IntegrationSlice<T>;
  /** Shown on the catalog card once installed. */
  statusLabel?: (cfg: T) => string | undefined;
  /** Extra fields to set on install, e.g. carrying over a legacy env value. */
  onInstall?: (cfg: T) => Partial<T> | Promise<Partial<T>>;
  /** Extra fields to set on uninstall. Omit to keep the config whole; pass a reset (e.g. wipe tokens) to drop it. */
  onUninstall?: (cfg: T) => Partial<T> | Promise<Partial<T>>;
  requires?: string[];
  nav?: PluginServer["nav"];
}): PluginServer {
  const { id, slice, statusLabel, onInstall, onUninstall, requires, nav } = opts;
  return {
    id,
    requires,
    nav,
    async status(): Promise<PluginStatus> {
      const cfg = await slice.get();
      return cfg.installed ? { installed: true, statusLabel: statusLabel?.(cfg) } : { installed: false };
    },
    async install() {
      const extra = onInstall ? await onInstall(await slice.get()) : {};
      await slice.update({ ...extra, installed: true } as Partial<T>);
    },
    async uninstall() {
      const extra = onUninstall ? await onUninstall(await slice.get()) : {};
      await slice.update({ ...extra, installed: false } as Partial<T>);
    },
  };
}

/** `get`/`set` for a slice keyed in the shared config blob, bound to a store at call time. */
export function sliceAccessors<S extends z.ZodType<Installable>>(key: string, schema: S) {
  type T = z.infer<S>;
  const slice = (store: IntegrationsConfigStore) => integrationSlice(key, schema, { store });
  return {
    slice,
    get: (store: IntegrationsConfigStore): Promise<T> => slice(store).get(),
    async set(store: IntegrationsConfigStore, next: T): Promise<void> {
      const cfg = await store.get();
      await store.set({ ...cfg, [key]: slice(store).parse(next) });
    },
  };
}
