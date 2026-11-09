import { describe, expect, it } from "vitest";
import { dateTimeFormat } from "./intl-format";

describe("dateTimeFormat", () => {
  it("returns one formatter per locale + options", () => {
    const a = dateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric" });
    const b = dateTimeFormat("en-US", { hour: "numeric", timeZone: "America/Toronto" });
    const c = dateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
