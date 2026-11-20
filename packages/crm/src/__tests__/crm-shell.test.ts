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

describe("CrmShell header", () => {
  const html = renderToStaticMarkup(
    createElement(CrmShell, {
      sidebar: createElement("nav", null, "side"),
      breadcrumbs: createElement("span", null, "crumb"),
      actions: createElement("button", null, "act"),
      children: "body",
    }),
  );
  const classesAround = (text: string) => html.match(new RegExp(`<div class="([^"]*)">(?:<[^>]+>)*${text}`))?.[1] ?? "";

  it("lays the header out as a three-column grid from md up", () => {
    expect(html).toMatch(/<header class="[^"]*md:grid md:grid-cols-\[1fr_auto_1fr\][^"]*"/);
  });

  it("centres the breadcrumbs in the middle column", () => {
    expect(classesAround("crumb").split(" ")).toContain("md:col-start-2");
  });

  it("puts the actions in the last column, right-aligned", () => {
    expect(classesAround("act").split(" ")).toEqual(expect.arrayContaining(["md:col-start-3", "md:justify-self-end"]));
  });
});
