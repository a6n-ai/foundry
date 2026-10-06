import { describe, expect, it } from "vitest";
import { googleSignInEnabled, googleSocialProviders } from "./social";

describe("googleSocialProviders", () => {
  it("mounts nothing until both keys are set", () => {
    expect(googleSocialProviders({})).toEqual({});
    expect(googleSocialProviders({ GOOGLE_CLIENT_ID: "id" })).toEqual({});
    expect(googleSignInEnabled({ GOOGLE_CLIENT_SECRET: "s" })).toBe(false);
  });

  it("only signs up when asked", () => {
    const env = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" };
    expect(googleSocialProviders(env).google).toMatchObject({ clientId: "id", clientSecret: "s", disableImplicitSignUp: true });
    expect(googleSignInEnabled(env)).toBe(true);
  });
});
