import { describe, expect, it } from "vitest";
import { buildMpBody, clientIdFromGaCookie } from "../mp";
import { gaScript } from "../ids";
import { createGoogleAnalytics } from "../config";
import { googleAnalyticsPlugin } from "../plugin.server";

describe("google analytics", () => {
  it("reads client_id from the _ga cookie", () => {
    expect(clientIdFromGaCookie("GA1.1.123456.1700000000")).toBe("123456.1700000000");
    expect(clientIdFromGaCookie("junk")).toBeNull();
  });

  it("falls back to a stable per-user client_id without a browser", () => {
    const body = buildMpBody({ clientId: null, userId: "42", event: { name: "purchase" } });
    expect(body.client_id).toBe("42.0");
    expect(body.user_id).toBe("42");
  });

  it("only interpolates a GA4-shaped ID", () => {
    expect(gaScript('G-1");alert(1)//')).toBe("");
    expect(gaScript("G-AB12CD34EF")).toContain('gtag("config","G-AB12CD34EF")');
  });

  it("uses the legacy ID until installed, and copies it in on install", async () => {
    let blob: Record<string, unknown> = {};
    const store = { get: async () => blob, set: async (n: Record<string, unknown>) => void (blob = n) };
    const ga = createGoogleAnalytics({ store, masterKey: () => null, legacyMeasurementId: () => "G-LEGACY01" });
    expect(ga.effectiveMeasurementId(await ga.getConfig())).toBe("G-LEGACY01");
    await googleAnalyticsPlugin(ga).install();
    expect(await ga.getConfig()).toMatchObject({ installed: true, measurementId: "G-LEGACY01" });
  });
});
