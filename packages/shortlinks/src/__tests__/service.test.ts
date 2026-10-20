import { describe, expect, it } from "vitest";
import { assertInAppPath, createShortLink, makeCode, normalizeCode } from "../service";

describe("codes", () => {
  it("are 8 characters with no look-alikes", () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
  });

  it("normalize case and reject anything else", () => {
    expect(normalizeCode(" k7m2qxab ")).toBe("K7M2QXAB");
    expect(normalizeCode("K7M2QXA")).toBeNull();
    expect(normalizeCode("K7M2QXA0")).toBeNull();
    expect(normalizeCode("../etc")).toBeNull();
  });
});

describe("assertInAppPath", () => {
  it("allows in-app paths", () => {
    expect(assertInAppPath("/subscribe?p=veg")).toBe("/subscribe?p=veg");
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "subscribe", "/a\r\nLocation: x", "/\t/evil.test", "/\n/evil.test", "/\\/evil.test"])("rejects %j", (t) => {
    expect(() => assertInAppPath(t)).toThrow();
  });
});

describe("createShortLink", () => {
  it("retries on a code collision", async () => {
    let calls = 0;
    const db = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => (++calls === 1 ? [] : [{ code: "X" }]),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const code = await createShortLink(db, { target: "/subscribe" });
    expect(calls).toBe(2);
    expect(normalizeCode(code)).toBe(code);
  });

  it("refuses an off-app target before touching the db", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(createShortLink({} as any, { target: "https://evil.test" })).rejects.toThrow();
  });
});
