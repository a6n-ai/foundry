import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppCaches, requestMemo } from "./app-caches";
import type { KvLike } from "./kv-tier";

const tiers = (c: unknown) => (c as { opts: { tiers: unknown[] } }).opts.tiers;

function fakeKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    put: async (k, v) => void store.set(k, v),
    delete: async (k) => void store.delete(k),
    list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
  };
}

describe("createAppCaches", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("off Workers both caches are LRU-only and never touch KV", async () => {
    const kv = vi.fn(fakeKv);
    const { sharedCache, configCache } = createAppCaches({ kv });
    expect(tiers(sharedCache("a"))).toHaveLength(1);
    await configCache("b").set("k", 1);
    expect(kv).not.toHaveBeenCalled();
  });

  it("on Workers sharedCache writes through to KV under its name", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const kv = fakeKv();
    const { sharedCache } = createAppCaches({ kv: () => kv });
    await sharedCache("x").set("k", 7);
    expect(kv.store.has("x:k")).toBe(true);
  });

  it("on Workers configCache stays per-isolate: KV is never read", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const kv = vi.fn(fakeKv);
    const c = createAppCaches({ kv }).configCache("settings");
    let calls = 0;
    expect(await c.getOrSet("s", async () => ++calls)).toBe(1);
    expect(await c.getOrSet("s", async () => ++calls)).toBe(1);
    expect(tiers(c)).toHaveLength(1);
    expect(kv).not.toHaveBeenCalled();
  });
});

describe("requestMemo", () => {
  it("loads each key once and shares the promise", async () => {
    const once = requestMemo();
    const load = vi.fn(async () => 1);
    const [a, b] = await Promise.all([once("k", load), once("k", load)]);
    expect([a, b]).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
    await once("other", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
