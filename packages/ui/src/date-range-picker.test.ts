import { describe, expect, it } from "vitest";
import { zonedEndOfDay, zonedStartOfDay } from "./date-range-picker";

describe("zoned day bounds", () => {
  it("Oct 19 in Toronto is 04:00Z to 03:59:59.999Z next day, whatever the browser zone", () => {
    expect(new Date(zonedStartOfDay(2026, 9, 19, "America/Toronto")).toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(new Date(zonedEndOfDay(2026, 9, 19, "America/Toronto")).toISOString()).toBe("2026-10-20T03:59:59.999Z");
  });

  it("handles the DST day (Nov 1 2026 is 25h in Toronto)", () => {
    expect(new Date(zonedStartOfDay(2026, 10, 1, "America/Toronto")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(zonedEndOfDay(2026, 10, 1, "America/Toronto")).toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });

  it("handles a positive-offset zone", () => {
    expect(new Date(zonedStartOfDay(2026, 9, 19, "Asia/Kolkata")).toISOString()).toBe("2026-10-18T18:30:00.000Z");
  });
});
