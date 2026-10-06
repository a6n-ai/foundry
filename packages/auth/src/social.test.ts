import { describe, expect, it } from "vitest";
import { googleSignInEnabled, googleSocialProviders } from "./social";

const env = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" };

describe("googleSocialProviders", () => {
  it("mounts nothing until both keys are set", () => {
    expect(googleSocialProviders({}, {})).toEqual({});
    expect(googleSocialProviders({}, { GOOGLE_CLIENT_ID: "id" })).toEqual({});
    expect(googleSignInEnabled({ GOOGLE_CLIENT_SECRET: "s" })).toBe(false);
    expect(googleSignInEnabled(env)).toBe(true);
  });

  it("is sign-in only unless the app opts in", () => {
    const google = googleSocialProviders({}, env).google;
    expect(google).toMatchObject({ clientId: "id", clientSecret: "s", disableSignUp: true });
    expect(google).not.toHaveProperty("disableImplicitSignUp");
  });

  it("with allowSignUp, signs up only when the page asks", () => {
    const google = googleSocialProviders({ allowSignUp: true }, env).google;
    expect(google).toMatchObject({ disableImplicitSignUp: true });
    expect(google).not.toHaveProperty("disableSignUp");
  });
});
