import { describe, it, expect } from "vitest";
import { parseStripeConfig, keyMode, stripeKeysError, stripeConfigSaveError } from "../config";

describe("stripe config", () => {
  it("defaults safely on garbage", () => {
    const c = parseStripeConfig("nope");
    expect(c.installed).toBe(false);
    expect(c.surcharge).toEqual({ enabled: false, ratePct: 0, excludeProvinces: ["QC"] });
    expect(c.tax).toEqual({ enabled: false, surchargeTaxable: false });
  });

  it("reads key mode", () => {
    expect(keyMode("rk_live_x")).toBe("live");
    expect(keyMode("sk_test_x")).toBe("test");
    expect(keyMode("pk_test_x")).toBe("test");
    expect(keyMode("whatever")).toBeNull();
  });

  it("rejects mismatched or wrong key types", () => {
    expect(stripeKeysError("rk_live_a", "pk_test_b")).toMatch(/same mode/);
    expect(stripeKeysError("pk_live_a", "pk_live_b")).toMatch(/secret or restricted/);
    expect(stripeKeysError("rk_live_a", "rk_live_b")).toMatch(/publishable/);
    expect(stripeKeysError("rk_test_a", "pk_test_b")).toBeNull();
  });

  it("guards surcharge and tax enablement", () => {
    const base = parseStripeConfig({ installed: true });
    expect(stripeConfigSaveError({ ...base, surcharge: { enabled: true, ratePct: 2.4, excludeProvinces: ["QC"] } })).toMatch(/notified/);
    expect(stripeConfigSaveError({ ...base, surcharge: { enabled: true, ratePct: 3, excludeProvinces: ["QC"], networksNotifiedOn: "2026-09-01" } })).toMatch(/2.4/);
    expect(stripeConfigSaveError({ ...base, tax: { enabled: true, surchargeTaxable: false } })).toMatch(/tax code/);
    expect(stripeConfigSaveError(base)).toBeNull();
  });
});
