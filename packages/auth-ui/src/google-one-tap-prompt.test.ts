import { afterEach, describe, expect, it, vi } from "vitest";
import { promptGoogleOneTap } from "./google-one-tap-prompt";

afterEach(() => vi.unstubAllGlobals());

describe("promptGoogleOneTap", () => {
  it("does not prompt off the registered origin, or with no configured origin", async () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const onSignedIn = vi.fn();
    await expect(promptGoogleOneTap("id", { onSignedIn }, "https://app.example.test")).resolves.toBeUndefined();
    await expect(promptGoogleOneTap("id", { onSignedIn }, undefined)).resolves.toBeUndefined();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
