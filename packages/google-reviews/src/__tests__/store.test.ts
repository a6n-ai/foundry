import { describe, it, expect } from "vitest";
import type { IntegrationsConfigStore } from "@foundry/commons/plugin";
import { getGoogleReviewsConfig, setGoogleReviewsConfig } from "../store";
import { googleReviewsPlugin } from "../plugin.server";

function memoryStore(initial: Record<string, unknown> = {}): IntegrationsConfigStore & {
  raw: () => Record<string, unknown>;
} {
  let cfg: Record<string, unknown> = { ...initial };
  return {
    get: async () => cfg,
    set: async (next) => {
      cfg = next as Record<string, unknown>;
    },
    raw: () => cfg,
  };
}

describe("google reviews store", () => {
  it("reads the default when nothing is stored", async () => {
    expect(await getGoogleReviewsConfig(memoryStore())).toEqual({
      installed: false,
      provider: "places",
    });
  });

  it("install sets installed without touching other plugin keys", async () => {
    const store = memoryStore({ clover: { installed: true, connected: true } });
    await googleReviewsPlugin(store).install();
    expect(store.raw().clover).toEqual({ installed: true, connected: true });
    expect(await getGoogleReviewsConfig(store)).toMatchObject({ installed: true });
  });

  it("uninstall clears installed but keeps the place id for reinstall", async () => {
    const store = memoryStore();
    await setGoogleReviewsConfig(store, {
      installed: true,
      placeId: "ChIJabc",
      provider: "places",
    });
    await googleReviewsPlugin(store).uninstall();
    expect(await getGoogleReviewsConfig(store)).toEqual({
      installed: false,
      placeId: "ChIJabc",
      provider: "places",
    });
  });
});
