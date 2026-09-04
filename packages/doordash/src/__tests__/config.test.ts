import { describe, it, expect } from "vitest";
import { parseDoorDashConfig, DEFAULT_DOORDASH_CONFIG } from "../config";

describe("parseDoorDashConfig", () => {
  it("returns the default for empty or invalid input", () => {
    expect(parseDoorDashConfig(undefined)).toEqual(DEFAULT_DOORDASH_CONFIG);
    expect(parseDoorDashConfig({ installed: "yes" })).toEqual(DEFAULT_DOORDASH_CONFIG);
  });

  it("rejects a non-URL string for url", () => {
    expect(parseDoorDashConfig({ installed: true, url: "not a url" })).toEqual(DEFAULT_DOORDASH_CONFIG);
  });

  it("keeps a configured store url", () => {
    const cfg = parseDoorDashConfig({ installed: true, url: "https://www.doordash.com/store/abc" });
    expect(cfg).toEqual({ installed: true, url: "https://www.doordash.com/store/abc" });
  });
});
