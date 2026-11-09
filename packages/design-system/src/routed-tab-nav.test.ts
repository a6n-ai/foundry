import { describe, expect, it } from "vitest";
import { activeTabHref } from "./routed-tab-nav";

const tabs = [{ href: "/s/email" }, { href: "/s/email/tracked" }, { href: "/s/email/advanced" }];

describe("activeTabHref", () => {
  it("picks the longest matching tab, not the base", () => {
    expect(activeTabHref(tabs, "/s/email")).toBe("/s/email");
    expect(activeTabHref(tabs, "/s/email/tracked")).toBe("/s/email/tracked");
    expect(activeTabHref(tabs, "/s/email/advanced/x")).toBe("/s/email/advanced");
  });
  it("falls back to the first tab", () => {
    expect(activeTabHref(tabs, "/other")).toBe("/s/email");
  });
});
