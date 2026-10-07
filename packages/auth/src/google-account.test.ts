import { describe, expect, it, vi } from "vitest";
import { googleAccountHooks, googlePicture, SIGN_IN_METHOD, signInPath } from "./google-account";

const token = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("signInPath", () => {
  it("names the OAuth provider so sign-in checks can match it", () => {
    expect(signInPath("/callback/:id", { id: "google" })).toBe("/callback/google");
    expect(signInPath("/sign-in/email")).toBe("/sign-in/email");
    expect(SIGN_IN_METHOD["/callback/google"]).toBe("google");
    expect(SIGN_IN_METHOD["/one-tap/callback"]).toBe("google");
  });
});

describe("googlePicture", () => {
  it("reads an https picture claim only", () => {
    expect(googlePicture(token({ picture: "https://lh3.googleusercontent.com/a" }))).toBe("https://lh3.googleusercontent.com/a");
    expect(googlePicture(token({ picture: "javascript:alert(1)" }))).toBeNull();
    expect(googlePicture(token({}))).toBeNull();
  });
});

describe("googleAccountHooks", () => {
  const deps = () => ({ isEmailVerified: vi.fn(async () => false), setImageIfEmpty: vi.fn(async () => {}) });

  it("ignores other providers", async () => {
    const d = deps();
    expect(await googleAccountHooks(d).create.before({ providerId: "credential", userId: "1" }, null)).toBeUndefined();
  });

  it("never stores Google tokens, and copies the photo", async () => {
    const d = deps();
    d.isEmailVerified.mockResolvedValue(true);
    const out = await googleAccountHooks(d).create.before(
      { providerId: "google", userId: "7", accessToken: "a", refreshToken: "r", idToken: token({ picture: "https://x.test/p" }) },
      null,
    );
    expect(out?.data).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
    expect(d.setImageIfEmpty).toHaveBeenCalledWith(7n, "https://x.test/p");
  });

  it("fails closed on an unverified account when the guard cannot run", async () => {
    await expect(googleAccountHooks(deps()).create.before({ providerId: "google", userId: "7" }, null)).rejects.toThrow(/verify your email/i);
  });

  it("drops refreshed tokens on update", async () => {
    const out = await googleAccountHooks(deps()).update.before({ accessToken: "new" });
    expect(out?.data).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
    expect(await googleAccountHooks(deps()).update.before({ scope: "x" })).toBeUndefined();
  });
});
