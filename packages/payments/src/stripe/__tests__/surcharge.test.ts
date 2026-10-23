import { describe, it, expect } from "vitest";
import { surchargeCents } from "../surcharge";

const cfg = { enabled: true, ratePct: 2.4, excludeProvinces: ["QC"], networksNotifiedOn: "2026-09-01" };

describe("surchargeCents", () => {
  it("charges credit only", () => {
    expect(surchargeCents({ funding: "credit", province: "ON", baseCents: 20000, cfg })).toBe(480);
    expect(surchargeCents({ funding: "debit", province: "ON", baseCents: 20000, cfg })).toBe(0);
    expect(surchargeCents({ funding: "prepaid", province: "ON", baseCents: 20000, cfg })).toBe(0);
    expect(surchargeCents({ funding: "unknown", province: "ON", baseCents: 20000, cfg })).toBe(0);
    expect(surchargeCents({ funding: null, province: "ON", baseCents: 20000, cfg })).toBe(0);
  });
  it("skips excluded provinces and unknown province", () => {
    expect(surchargeCents({ funding: "credit", province: "QC", baseCents: 20000, cfg })).toBe(0);
    expect(surchargeCents({ funding: "credit", province: null, baseCents: 20000, cfg })).toBe(0);
  });
  it("is zero when disabled", () => {
    expect(surchargeCents({ funding: "credit", province: "ON", baseCents: 20000, cfg: { ...cfg, enabled: false } })).toBe(0);
  });
  it("rounds half-up to the cent", () => {
    expect(surchargeCents({ funding: "credit", province: "ON", baseCents: 1021, cfg })).toBe(25); // 24.504
  });
  it("never exceeds the cap even if config is corrupted", () => {
    expect(surchargeCents({ funding: "credit", province: "ON", baseCents: 10000, cfg: { ...cfg, ratePct: 9 } })).toBe(240);
  });
});
