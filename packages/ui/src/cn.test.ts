import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn type scale", () => {
  it("keeps a colour next to a scale size", () => {
    expect(cn("text-footnote text-muted-foreground")).toBe("text-footnote text-muted-foreground");
    expect(cn("text-display-l text-primary")).toBe("text-display-l text-primary");
  });

  it("lets a later scale size replace an earlier one", () => {
    expect(cn("text-sm", "text-display-m")).toBe("text-display-m");
    expect(cn("text-display-xs", "text-caption")).toBe("text-caption");
  });
});
