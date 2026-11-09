import { describe, expect, it } from "vitest";
import {
  addDaysIso, dayRange, daysBetween, eachDate, isRealDate, isoDateInZone, isWeekend, mondayIndex, mondayOfIso, nextWeekday,
  parseIsoDateUtc, weekdayKey,
} from "./dates";

const d = (iso: string) => parseIsoDateUtc(iso);

describe("weekdayKey", () => {
  it("maps known dates to weekday keys", () => {
    expect(weekdayKey(d("2026-06-22"))).toBe("mon"); // a Monday
    expect(weekdayKey(d("2026-06-26"))).toBe("fri");
    expect(weekdayKey(d("2026-06-27"))).toBe("sat");
    expect(weekdayKey(d("2026-06-28"))).toBe("sun");
  });
});

describe("isWeekend", () => {
  it("is true for Sat/Sun only", () => {
    expect(isWeekend(d("2026-06-27"))).toBe(true);
    expect(isWeekend(d("2026-06-28"))).toBe(true);
    expect(isWeekend(d("2026-06-26"))).toBe(false);
  });
});

describe("nextWeekday", () => {
  it("returns the next day when that day is a weekday", () => {
    expect(weekdayKey(nextWeekday(d("2026-06-22")))).toBe("tue"); // Mon -> Tue
  });
  it("skips the weekend from Friday", () => {
    const r = nextWeekday(d("2026-06-26")); // Fri -> Mon
    expect(weekdayKey(r)).toBe("mon");
    expect(r.getUTCDate()).toBe(29);
  });
  it("skips the weekend from Saturday and Sunday", () => {
    expect(weekdayKey(nextWeekday(d("2026-06-27")))).toBe("mon");
    expect(weekdayKey(nextWeekday(d("2026-06-28")))).toBe("mon");
  });
});

describe("parseIsoDateUtc", () => {
  it("throws on malformed input", () => {
    expect(() => parseIsoDateUtc("2026/06/22")).toThrow();
    expect(() => parseIsoDateUtc("nope")).toThrow();
  });
  it("throws on out-of-range calendar values (no silent wrap)", () => {
    expect(() => parseIsoDateUtc("2026-02-30")).toThrow();
    expect(() => parseIsoDateUtc("2026-13-01")).toThrow();
    expect(() => parseIsoDateUtc("2026-00-10")).toThrow();
  });
});

describe("iso-day arithmetic", () => {
  it("addDaysIso rolls across months and years", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("mondayOfIso snaps every weekday, Sunday included, to its Monday", () => {
    expect(mondayOfIso("2026-06-24")).toBe("2026-06-22");
    expect(mondayOfIso("2026-06-22")).toBe("2026-06-22");
    expect(mondayOfIso("2026-06-28")).toBe("2026-06-22");
    expect(mondayIndex("2026-10-01")).toBe(3);
  });

  it("daysBetween counts signed calendar days", () => {
    expect(daysBetween("2026-08-19", "2026-09-02")).toBe(14);
    expect(daysBetween("2026-08-19", "2026-08-18")).toBe(-1);
  });

  it("eachDate is inclusive and empty when reversed", () => {
    expect(eachDate("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(eachDate("2026-03-02", "2026-02-27")).toEqual([]);
  });

  it("isRealDate rejects rollover and malformed dates", () => {
    expect(isRealDate("2026-02-28")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2026-2-3")).toBe(false);
  });

  it("dayRange spans a 23-hour DST day in the zone", () => {
    const { start, end } = dayRange("2026-03-08", "America/Toronto");
    expect(end - start).toBe(23 * 3_600_000);
    expect(isoDateInZone(start, "America/Toronto")).toBe("2026-03-08");
    expect(isoDateInZone(end - 1, "America/Toronto")).toBe("2026-03-08");
  });
});
