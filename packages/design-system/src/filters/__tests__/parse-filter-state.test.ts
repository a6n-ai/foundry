import { describe, it, expect } from "vitest";
import { parseFilterState, type FacetDef, DEFAULT_SIZE } from "../parse-filter-state";

const spec: FacetDef[] = [
  { kind: "pills", field: "stage", label: "Stage", options: [{ value: "won", label: "Won" }] },
  { kind: "select", field: "owner", label: "Owner", options: [] },
  { kind: "multi", field: "source", label: "Source", options: [] },
  { kind: "dateRange", field: "createdAt", label: "Created" },
  { kind: "search", fields: ["name", "phone"] },
];

describe("parseFilterState", () => {
  it("defaults: no params → no condition, page 0, default size", () => {
    const s = parseFilterState(spec, {});
    expect(s.condition).toBeUndefined();
    expect(s.page).toEqual({ page: 0, size: DEFAULT_SIZE });
    expect(s.q).toBe("");
  });

  it("pills → eq, select → eq, multi (csv) → in, date → between, search → or(like)", () => {
    const s = parseFilterState(spec, {
      stage: "won", owner: "usr_1", source: "website,google",
      from: "100", to: "200", q: "pri", page: "2", size: "50",
    });
    expect(s.q).toBe("pri");
    expect(s.page).toEqual({ page: 2, size: 50 });
    // condition is and(eq stage, eq owner, in source, between createdAt, or(like name, like phone))
    expect(s.condition?.type).toBe("complex");
    const kinds = (s.condition as any).conditions.map((c: any) => c.field ?? c.operator);
    expect(kinds).toContain("stage");
    expect(kinds).toContain("source");
    expect(kinds).toContain("createdAt");
  });

  it("clamps bad size to nearest allowed and negative page to 0", () => {
    const s = parseFilterState(spec, { size: "9999", page: "-3" });
    expect(s.page.size).toBe(100);
    expect(s.page.page).toBe(0);
  });

  it("garbage date/from-after-to is handled (swap), non-numeric ignored", () => {
    const s = parseFilterState(spec, { from: "300", to: "100" });
    const dr = (s.condition as any).conditions[0];
    expect(dr.operator).toBe("between");
    expect(dr.value).toEqual([100, 300]); // swapped
    const s2 = parseFilterState(spec, { from: "abc" });
    expect(s2.condition).toBeUndefined(); // non-numeric single bound ignored
  });

  it("search splits on whitespace: each word must match some field", () => {
    const s = parseFilterState(spec, { q: "  Ram   Kumar " });
    expect(s.q).toBe("Ram Kumar");
    const words = (s.condition as any).conditions.map((c: any) => c.conditions.map((l: any) => l.value));
    expect(words).toEqual([["%Ram%", "%Ram%"], ["%Kumar%", "%Kumar%"]]);
  });

  it("empty multi value → facet dropped", () => {
    const s = parseFilterState(spec, { source: "" });
    expect(s.condition).toBeUndefined();
  });
});

describe("parseFilterState date bounds", () => {
  const date: FacetDef[] = [{ kind: "dateRange", field: "createdAt", label: "Created" }];
  const between = (sp: Record<string, string>, timeZone?: string) =>
    (parseFilterState(date, sp, { timeZone }).condition as any)?.conditions[0].value;

  it("reads ISO days as the inclusive zoned window", () => {
    expect(between({ from: "2026-11-14", to: "2026-11-20" }, "America/Toronto")).toEqual([
      Date.parse("2026-11-14T05:00:00Z"),
      Date.parse("2026-11-21T05:00:00Z") - 1,
    ]);
  });

  it("swaps a reversed ISO pair and keeps epoch as is", () => {
    expect(between({ from: "2026-11-20", to: "2026-11-14" }, "UTC")).toEqual([Date.parse("2026-11-14T00:00:00Z"), Date.parse("2026-11-21T00:00:00Z") - 1]);
    expect(between({ from: "100", to: "200" })).toEqual([100, 200]);
  });

  it("ignores huge digits and impossible dates", () => {
    expect(parseFilterState(date, { from: "9".repeat(400), to: "2026-02-30" }).condition).toBeUndefined();
  });
});
