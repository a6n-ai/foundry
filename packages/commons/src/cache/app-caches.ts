import { isWorkers } from "../runtime/platform";
import { KvTier, type KvLike } from "./kv-tier";
import { LruTier } from "./lru-tier";
import { TieredCache } from "./tiered-cache";

export interface AppCachesOptions {
  /** The Workers KV namespace for the shared tier, read per call (env is bound per request). */
  kv: () => KvLike | Promise<KvLike>;
}

const WORKERS_L1_CAP_MS = 60_000;

// Another isolate's L1 cannot be evicted, so a cache that public pages regenerate from must not hold
// a copy longer than the cap, or a revalidation re-caches the stale value.
class CappedLruTier extends LruTier {
  constructor(private readonly capMs: number) {
    super();
  }
  override set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    return super.set(key, value, Math.min(ttlMs || this.capMs, this.capMs));
  }
}

/**
 * An app's two cache kinds, wired once per app:
 *
 * - `sharedCache`: read-through L1 in-process LRU, then L2 Workers KV (Workers only; Node
 *   dev, tests and builds are LRU-only). For data that may lag ~60 s across locations.
 * - `configCache`: admin-edited config that must reflect a write at once. KV is eventually
 *   consistent and cannot be evicted across locations, so on Workers this is a per-isolate
 *   LRU with a 5 s TTL: Postgres is read at most every 5 s per isolate. Evict on every write.
 *
 * `name` namespaces keys and scopes `evictAll()` to just that cache.
 */
export function createAppCaches({ kv }: AppCachesOptions) {
  function sharedCache(name: string, defaultTtlMs = 60_000, kvRetainMs = 0, capWorkersL1 = false): TieredCache {
    const workers = isWorkers();
    const l1 = workers && capWorkersL1 ? new CappedLruTier(WORKERS_L1_CAP_MS) : new LruTier();
    return new TieredCache({ name, tiers: workers ? [l1, new KvTier(name, kv, kvRetainMs)] : [l1], defaultTtlMs });
  }

  // defaultTtlMs is intentionally ignored on Workers (5 s LRU only).
  function configCache(name: string, defaultTtlMs = 60_000): TieredCache {
    return isWorkers()
      ? new TieredCache({ name, tiers: [new LruTier()], defaultTtlMs: 5_000 })
      : sharedCache(name, defaultTtlMs);
  }

  return { sharedCache, configCache };
}

/**
 * A memo for one request or one bulk job: the first call for a key loads, later calls share
 * that promise. Never keep one across requests; it has no TTL and no eviction.
 */
export function requestMemo() {
  const memo = new Map<string, Promise<unknown>>();
  return <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (!memo.has(key)) memo.set(key, load());
    return memo.get(key) as Promise<T>;
  };
}
