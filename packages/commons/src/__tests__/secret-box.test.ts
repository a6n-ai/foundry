import { describe, it, expect } from "vitest";
import { seal, open, isEnvelope, generateKeyB64 } from "../secret-box";

const key = generateKeyB64();

describe("secret-box", () => {
  it("round-trips", () => {
    const env = seal("rk_test_abc123", key);
    expect(isEnvelope(env)).toBe(true);
    expect(env.ct).not.toContain("rk_test");
    expect(open(env, key)).toBe("rk_test_abc123");
  });

  it("uses a fresh IV every seal", () => {
    expect(seal("x", key).iv).not.toBe(seal("x", key).iv);
  });

  it("rejects a tampered ciphertext", () => {
    const env = seal("secret", key);
    const ct = Buffer.from(env.ct, "base64");
    ct[0] ^= 1;
    expect(() => open({ ...env, ct: ct.toString("base64") }, key)).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => open(seal("secret", key), generateKeyB64())).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => seal("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
