// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { activeTabHref, RoutedTabNav } from "./routed-tab-nav"

const pathname = vi.hoisted(() => ({ value: "/s/email" }))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }))
vi.mock("next/link", () => ({
  default: ({ prefetch: _prefetch, ...props }: { prefetch?: boolean } & React.ComponentProps<"a">) => <a {...props} />,
}))

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

describe("RoutedTabNav keyboard", () => {
  beforeAll(() => {
    Element.prototype.getAnimations = () => [];
    Element.prototype.scrollIntoView = function () {};
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(cleanup);

  it("arrow keys move focus without following the link; Enter follows", () => {
    pathname.value = "/s/email";
    const followed: string[] = [];
    const follow = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      e.preventDefault();
      followed.push(a.getAttribute("href") ?? "");
    };
    document.addEventListener("click", follow, true);
    try {
      render(
        <RoutedTabNav
          ariaLabel="Email"
          tabs={[
            { href: "/s/email", label: "General" },
            { href: "/s/email/tracked", label: "Tracked" },
          ]}
        />
      );
      const general = screen.getByRole("tab", { name: "General" });

      general.focus();
      fireEvent.keyDown(general, { key: "ArrowRight" });

      expect(screen.getByRole("tab", { name: "Tracked" })).toHaveFocus();
      expect(general).toHaveAttribute("aria-selected", "true");
      expect(followed).toEqual([]);

      const enterNotPrevented = fireEvent.keyDown(screen.getByRole("tab", { name: "Tracked" }), { key: "Enter", cancelable: true });

      expect(enterNotPrevented).toBe(true);
    } finally {
      document.removeEventListener("click", follow, true);
    }
  });
});
