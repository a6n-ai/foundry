import { describe, it, expect } from "vitest";
import { seal, generateKeyB64 } from "@foundry/commons/secret-box";
import { getStripe, StripeNotConfiguredError, clearStripeCache } from "../client";

const key = generateKeyB64();
const deps = (stripe: unknown, mk = key) => ({ store: { get: async () => ({ stripe }), set: async () => {} }, masterKey: () => mk });
const sealed = () => seal("rk_test_x", key, "stripe.secretKey");

describe("getStripe", () => {
  it("throws when not connected", async () => {
    clearStripeCache();
    await expect(getStripe(deps({ installed: true }))).rejects.toBeInstanceOf(StripeNotConfiguredError);
  });
  it("throws when the master key is missing, without leaking anything", async () => {
    clearStripeCache();
    const e = await getStripe(deps({ installed: true, accountId: "acct_1", secretKey: sealed() }, "")).catch((x) => x);
    expect(e).toBeInstanceOf(StripeNotConfiguredError);
    expect(String(e.message)).not.toContain("rk_test");
  });
  it("decrypts and caches per account", async () => {
    clearStripeCache();
    const d = deps({ installed: true, accountId: "acct_1", secretKey: sealed() });
    const a = await getStripe(d);
    const b = await getStripe(d);
    expect(a.stripe).toBe(b.stripe);
  });
});
