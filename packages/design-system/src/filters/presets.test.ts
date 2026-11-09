import { describe, expect, it } from "vitest";
import { activePresetKey, applyPreset, facetFields, managedKeys, type FilterPreset } from "./presets";
import type { FacetDef } from "./facet";

const spec: FacetDef[] = [
  { kind: "search", fields: ["name"] },
  { kind: "select", field: "status", label: "Status", options: [] },
  { kind: "dateRange", field: "createdAt", label: "Created" },
];
const presets: FilterPreset[] = [
  { key: "late", label: "Late", params: { status: "late", ending: "soon" } },
  { key: "done", label: "Done", params: { status: "done" } },
];

describe("filter presets", () => {
  it("facetFields skips search and date facets", () => {
    expect(facetFields(spec)).toEqual(["status"]);
  });

  it("applying a preset replaces stale picks and resets the page", () => {
    const managed = managedKeys(presets, facetFields(spec));
    const next = applyPreset(new URLSearchParams("status=done&ending=soon&page=3&q=x"), presets[0]!, managed);
    expect(Object.fromEntries(next)).toEqual({ status: "late", ending: "soon", q: "x" });
  });

  it("applying no preset clears every managed key", () => {
    const managed = managedKeys(presets, facetFields(spec));
    expect(applyPreset(new URLSearchParams("status=done&ending=soon&q=x"), null, managed).toString()).toBe("q=x");
  });

  it("a chip is active only when the URL matches exactly its params", () => {
    const managed = managedKeys(presets, facetFields(spec));
    expect(activePresetKey(new URLSearchParams("status=done"), presets, managed)).toBe("done");
    expect(activePresetKey(new URLSearchParams("status=done&ending=soon"), presets, managed)).toBeNull();
    expect(activePresetKey(new URLSearchParams(""), presets, managed)).toBeNull();
  });
});
