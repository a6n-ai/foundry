import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { integrationSlice, slicePlugin } from "../plugin-kit";
import { sealedSecret } from "../secret-box";

function memoryStore(initial: Record<string, unknown> = {}) {
  let blob = structuredClone(initial);
  return { get: async () => structuredClone(blob), set: async (next: Record<string, unknown>) => void (blob = next), peek: () => blob };
}

const schema = z.object({ installed: z.boolean().default(false), id: z.string().nullable().default(null) });

describe("plugin kit", () => {
  it("installs and uninstalls without touching other keys or the plugin's own settings", async () => {
    const store = memoryStore({ other: { keep: true }, demo: { id: "abc" } });
    const plugin = slicePlugin({ id: "demo", slice: integrationSlice("demo", schema, { store }), statusLabel: (c) => (c.id ? "Connected" : "Missing") });

    await plugin.install();
    expect(await plugin.status()).toEqual({ installed: true, statusLabel: "Connected" });
    await plugin.uninstall();
    expect(store.peek()).toEqual({ other: { keep: true }, demo: { installed: false, id: "abc" } });
  });

  it("reads through readStore but writes from the uncached store", async () => {
    const store = memoryStore({ demo: { installed: true, id: "fresh" } });
    const stale = memoryStore({ demo: { installed: true, id: "stale" } });
    const slice = integrationSlice("demo", schema, { store, readStore: stale });
    expect((await slice.get()).id).toBe("stale");
    await slice.update({ installed: false });
    expect(store.peek().demo).toEqual({ installed: false, id: "fresh" });
  });

  it("applies onInstall extras and falls back to defaults on a corrupt slice", async () => {
    const store = memoryStore({ demo: { installed: "yes" } });
    const slice = integrationSlice("demo", schema, { store });
    expect(await slice.get()).toEqual({ installed: false, id: null });
    await slicePlugin({ id: "demo", slice, onInstall: () => ({ id: "from-env" }) }).install();
    expect(store.peek().demo).toEqual({ installed: true, id: "from-env" });
  });

  it("seals only with a key and opens only in the same context", () => {
    let key = "";
    const secret = sealedSecret("demo.token", () => key);
    expect(secret.seal("t0ken")).toBeNull();
    key = randomBytes(32).toString("base64");
    const env = secret.seal("t0ken");
    expect(secret.open(env)).toBe("t0ken");
    expect(sealedSecret("other.field", () => key).open(env)).toBeNull();
  });
});
