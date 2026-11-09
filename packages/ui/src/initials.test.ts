import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("takes first and last word", () => expect(initials("hrithik raj kumar")).toBe("HK"));
  it("takes two letters of a one-word name", () => expect(initials("Admin")).toBe("AD"));
  it("falls back for empty names", () => expect(initials("  ")).toBe("?"));
});
