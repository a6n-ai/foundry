import { describe, it, expect } from "vitest";
import { parseUberEatsConfig, DEFAULT_UBER_EATS_CONFIG } from "../config";

describe("parseUberEatsConfig", () => {
  it("returns the default for empty or invalid input", () => {
    expect(parseUberEatsConfig(undefined)).toEqual(DEFAULT_UBER_EATS_CONFIG);
    expect(parseUberEatsConfig({ installed: "yes" })).toEqual(DEFAULT_UBER_EATS_CONFIG);
  });

  it("rejects a non-URL string for url", () => {
    expect(parseUberEatsConfig({ installed: true, url: "not a url" })).toEqual(DEFAULT_UBER_EATS_CONFIG);
  });

  it("keeps a configured store url", () => {
    const cfg = parseUberEatsConfig({ installed: true, url: "https://www.ubereats.com/ca/store/abc" });
    expect(cfg).toEqual({ installed: true, url: "https://www.ubereats.com/ca/store/abc" });
  });
});
