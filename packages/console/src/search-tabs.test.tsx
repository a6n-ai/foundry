// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ConsoleRouterProvider, type ConsoleSearch } from "./router"
import { SearchTabs } from "./search-tabs"
import { createMemoryConsoleRouter } from "./testing"

afterEach(cleanup)

const tabs = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
]

function tabsFor(search: ConsoleSearch) {
  render(
    <ConsoleRouterProvider router={createMemoryConsoleRouter({ pathname: "/inquiries", search })}>
      <SearchTabs param="view" tabs={tabs} reset={["page"]} />
    </ConsoleRouterProvider>,
  )
}

describe("SearchTabs", () => {
  it("first tab active when unset", () => {
    tabsFor({})
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Mine" })).not.toHaveAttribute("aria-current")
  })

  it("tab link sets param and drops reset keys", () => {
    tabsFor({ view: "mine", page: 3, q: "x" })
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/inquiries?view=all&q=x")
  })
})
