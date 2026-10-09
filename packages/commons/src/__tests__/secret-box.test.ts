import { describe, it, expect } from "vitest";
import { seal, open, isEnvelope, generateKeyB64 } from "../secret-box";

const key = generateKeyB64();
const ctx = "test.ctx";

describe("secret-box", () => {
  it("round-trips", () => {
    const env = seal("rk_test_abc123", key, ctx);
    expect(isEnvelope(env)).toBe(true);
    expect(env.ct).not.toContain("rk_test");
    expect(open(env, key, ctx)).toBe("rk_test_abc123");
  });

  it("round-trips an empty plaintext", () => {
    expect(open(seal("", key, ctx), key, ctx)).toBe("");
  });

  it("uses a fresh IV every seal", () => {
    expect(seal("x", key, ctx).iv).not.toBe(seal("x", key, ctx).iv);
  });

  it("rejects a tampered ciphertext", () => {
    const env = seal("secret", key, ctx);
    const ct = Buffer.from(env.ct, "base64");
    ct[0] ^= 1;
    expect(() => open({ ...env, ct: ct.toString("base64") }, key, ctx)).toThrow();
  });

  it("rejects a tampered iv", () => {
    const env = seal("secret", key, ctx);
    const iv = Buffer.from(env.iv, "base64");
    iv[0] ^= 1;
    expect(() => open({ ...env, iv: iv.toString("base64") }, key, ctx)).toThrow();
  });

  it("rejects a truncated tag", () => {
    const env = seal("secret", key, ctx);
    const tag = Buffer.from(env.tag, "base64").subarray(0, 4);
    expect(() => open({ ...env, tag: tag.toString("base64") }, key, ctx)).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => open(seal("secret", key, ctx), generateKeyB64(), ctx)).toThrow();
  });

  it("rejects a different context", () => {
    expect(() => open(seal("secret", key, ctx), key, "other.ctx")).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => seal("x", Buffer.alloc(16).toString("base64"), ctx)).toThrow(/32 bytes/);
  });

  it("isEnvelope rejects non-envelopes", () => {
    const env = seal("x", key, ctx);
    const { ct: _ct, ...missingCt } = env;
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({ ...env, v: 2 })).toBe(false);
    expect(isEnvelope(missingCt)).toBe(false);
  });
});
