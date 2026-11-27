import { describe, expect, it } from "vitest";
import { makePublicId, newId } from "../ids";

describe("ids", () => {
  it("newId matches the format", () => {
    expect(newId("inq")).toMatch(/^inq_[0-9A-Za-z_-]{12}$/);
  });
  it("rejects bad prefixes", () => {
    expect(() => newId("Inq")).toThrow();
    expect(() => makePublicId("ab")).toThrow();
  });
});
