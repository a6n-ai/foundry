import { describe, expect, it } from "vitest";
import { normalizeUsername, randomUsername, suggestUsername } from "../username";

describe("normalizeUsername", () => {
  it("lowercases the key and keeps display casing", () => {
    expect(normalizeUsername("  Priya.Sharma ")).toEqual({ username: "priya.sharma", displayUsername: "Priya.Sharma" });
  });
  it("accepts a leading @", () => {
    expect(normalizeUsername("@kid_01").username).toBe("kid_01");
  });
  it.each(["ab", "a".repeat(31), "has space", "émile", "x-y", ""])("rejects %j", (bad) => {
    expect(() => normalizeUsername(bad)).toThrow(/3–30 characters/);
  });
});

describe("suggestUsername", () => {
  it("slugs the name and adds digits", () => {
    expect(suggestUsername("Priya Sharma!", () => 4821)).toBe("priyasharma4821");
  });
  it("falls back when the name is too short or empty", () => {
    expect(suggestUsername("A", () => 1234)).toBe("user1234");
    expect(suggestUsername(null, () => 1234)).toBe("user1234");
  });
  it("always passes the rule", () => {
    expect(() => normalizeUsername(suggestUsername("Émile-Zoë Dubois-Montgomery-Smith"))).not.toThrow();
    expect(() => normalizeUsername(suggestUsername("李小龙"))).not.toThrow();
  });
});

describe("randomUsername", () => {
  it("is unguessable, passes the rule and differs each time", () => {
    const a = randomUsername();
    expect(a).toMatch(/^user_[a-z0-9]{8}$/);
    expect(() => normalizeUsername(a)).not.toThrow();
    expect(new Set(Array.from({ length: 50 }, randomUsername)).size).toBe(50);
  });
});
