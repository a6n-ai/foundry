import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmShell } from "../crm-shell";

const render = (sidebarWidth?: string) =>
  renderToStaticMarkup(
    createElement(CrmShell, { sidebar: createElement("nav", null, "side"), sidebarWidth, children: "body" }),
  );

describe("CrmShell sidebar width", () => {
  it("passes sidebarWidth through as the sidebar CSS variable", () => {
    expect(render("264px")).toContain("--sidebar-width:264px");
  });

  it("keeps the provider default when no width is given", () => {
    expect(render()).toContain("--sidebar-width:16rem");
  });
});
