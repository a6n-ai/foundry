import { describe, expect, it } from "vitest";
import { postalArea } from "../fsa";

describe("postalArea", () => {
  it("names an FSA with no bracketed neighbourhoods", () => {
    expect(postalArea("M7A")).toEqual({ name: "Queen's Park Ontario Provincial Government", neighbourhoods: null });
  });

  it("splits the area from its neighbourhoods and accepts a full, lowercase, spaced code", () => {
    expect(postalArea(" m8v 1a1 ")).toEqual({
      name: "Etobicoke",
      neighbourhoods: "New Toronto / Mimico South / Humber Bay Shores",
    });
  });

  it("summarises a short prefix by its most common area names", () => {
    expect(postalArea("M8")).toEqual({ name: "Etobicoke", neighbourhoods: null });
    expect(postalArea("L5")?.name).toBe("Mississauga");
    expect(postalArea("M5", 2)?.name.split(", ")).toHaveLength(2);
  });

  it("returns null for unknown or empty input", () => {
    expect(postalArea("Z9Z")).toBeNull();
    expect(postalArea("")).toBeNull();
  });
});
