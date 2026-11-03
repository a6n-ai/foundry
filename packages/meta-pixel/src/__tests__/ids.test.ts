import { describe, expect, it } from "vitest";
import { fbcFromFbclid, normalizePixelId } from "../ids";
import { pixelScript } from "../script";

describe("pixel ids", () => {
  it("pulls the ID out of pasted text with invisible marks or a label", () => {
    expect(normalizePixelId("1234567890123456")).toBe("1234567890123456");
    expect(normalizePixelId("‎1234567890123456‏ ")).toBe("1234567890123456");
    expect(normalizePixelId("Pixel ID: 1234567890123456")).toBe("1234567890123456");
    expect(normalizePixelId("123 456")).toBeNull();
    expect(normalizePixelId("EAAB-not-an-id")).toBeNull();
  });

  it("builds _fbc from an fbclid in the URL", () => {
    expect(fbcFromFbclid("https://x.test/?a=1&fbclid=AbC", 42)).toBe("fb.1.42.AbC");
    expect(fbcFromFbclid("https://x.test/")).toBeUndefined();
  });

  it("only interpolates a digits-only pixel ID into the bootstrap", () => {
    expect(pixelScript(null)).toBe("");
    expect(pixelScript('1");alert(1)//')).toBe("");
    expect(pixelScript("123456789")).toContain('fbq("init","123456789")');
  });
});
