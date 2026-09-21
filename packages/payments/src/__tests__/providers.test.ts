import { describe, it, expect } from "vitest";
import { PAYMENT_PROVIDERS, findPaymentProvider, mergePaymentCatalog } from "../providers";

describe("PAYMENT_PROVIDERS", () => {
  it("ships cash (default on) then e-Transfer — no card/Stripe rail", () => {
    expect(PAYMENT_PROVIDERS.map((p) => p.id)).toEqual(["cash", "etransfer"]);
    expect(findPaymentProvider("stripe")).toBeUndefined();
    expect(findPaymentProvider("manual")).toBeUndefined();
  });

  it("seeds cash enabled so it is available without an extra toggle", () => {
    expect(findPaymentProvider("cash")!.seed()).toEqual({
      id: "cash",
      kind: "manual",
      enabled: true,
      label: "Cash on delivery",
      taxes: [],
    });
  });

  it("seeds etransfer disabled until a payee handle is set", () => {
    expect(findPaymentProvider("etransfer")!.seed()).toEqual({
      id: "etransfer",
      kind: "manual",
      enabled: false,
      label: "Interac e-Transfer",
      taxes: [],
    });
  });
});

describe("mergePaymentCatalog", () => {
  it("inserts enabled cash into an empty config", () => {
    const next = mergePaymentCatalog({ methods: [] });
    expect(next.methods.map((m) => [m.id, m.enabled])).toEqual([
      ["cash", true],
      ["etransfer", false],
    ]);
  });

  it("does not re-enable cash the admin turned off", () => {
    const next = mergePaymentCatalog({
      methods: [{ id: "cash", kind: "manual", enabled: false, label: "Cash on delivery", taxes: [] }],
    });
    expect(next.methods.find((m) => m.id === "cash")?.enabled).toBe(false);
    expect(next.methods.map((m) => m.id)).toEqual(["cash", "etransfer"]);
  });
});
