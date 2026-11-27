// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AppShell } from "./app-shell"
import type { NavGroup } from "./nav"
import { ConsoleRouterProvider } from "./router"
import { createMemoryConsoleRouter } from "./testing"

afterEach(cleanup)

const nav: NavGroup[] = [
  { items: [{ label: "Inquiries", to: "/inquiries", badge: "7" }] },
  { label: "Admin", items: [{ label: "Team", to: "/team" }] },
]

function shell(pathname: string) {
  render(
    <ConsoleRouterProvider router={createMemoryConsoleRouter({ pathname })}>
      <AppShell appName="a6n CRM" brand="Brand" nav={nav} user={{ name: "Ada", email: "ada@a6n.ai" }} userMenu={<div />}>
        <p>content</p>
      </AppShell>
    </ConsoleRouterProvider>,
  )
}

describe("AppShell", () => {
  it("marks the active item", () => {
    shell("/team")
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: /Inquiries/ })).not.toHaveAttribute("aria-current")
  })

  it("renders badge and group label", () => {
    shell("/")
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })
})
