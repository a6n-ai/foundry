// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Pager } from "./pager"
import { ConsoleRouterProvider, type ConsoleSearch } from "./router"
import { createMemoryConsoleRouter } from "./testing"

afterEach(cleanup)

const show = (page: number, hasNext: boolean, search: ConsoleSearch = {}) =>
  render(
    <ConsoleRouterProvider router={createMemoryConsoleRouter({ pathname: "/inquiries", search: page > 1 ? { ...search, page } : search })}>
      <Pager page={page} hasNext={hasNext} />
    </ConsoleRouterProvider>,
  )

describe("Pager", () => {
  it("page 1 has no Previous", () => {
    show(1, true)
    expect(screen.queryByRole("link", { name: /Previous/ })).toBeNull()
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/inquiries?page=2")
  })

  it("Previous from page 2 drops page", () => {
    show(2, true)
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute("href", "/inquiries")
  })

  it("no Next when hasNext is false", () => {
    show(2, false)
    expect(screen.queryByRole("link", { name: /Next/ })).toBeNull()
  })
})
