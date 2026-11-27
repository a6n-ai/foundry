// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConsoleLink, ConsoleRouterProvider, useConsoleRouter } from "./router"
import { createMemoryConsoleRouter } from "./testing"

afterEach(cleanup)

function Probe() {
  useConsoleRouter()
  return null
}

describe("router", () => {
  it("useConsoleRouter throws outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(new Error("ConsoleRouterProvider is missing"))
  })

  it("ConsoleLink renders the adapter Link", () => {
    render(
      <ConsoleRouterProvider router={createMemoryConsoleRouter()}>
        <ConsoleLink to="/inquiries" search={{ view: "all" }}>
          All
        </ConsoleLink>
      </ConsoleRouterProvider>,
    )
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/inquiries?view=all")
  })
})
