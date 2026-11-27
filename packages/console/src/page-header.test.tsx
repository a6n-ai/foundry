// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AppShell } from "./app-shell"
import { PageHeader } from "./page-header"
import { ConsoleRouterProvider } from "./router"
import { createMemoryConsoleRouter } from "./testing"

afterEach(cleanup)

describe("PageHeader", () => {
  it("sets document.title", () => {
    render(
      <ConsoleRouterProvider router={createMemoryConsoleRouter()}>
        <AppShell appName="a6n CRM" brand="Brand" nav={[]} user={{ name: "Ada", email: "ada@a6n.ai" }} userMenu={null}>
          <PageHeader crumbs={[{ label: "Inquiries", to: "/inquiries" }, { label: "Acme" }]} />
        </AppShell>
      </ConsoleRouterProvider>,
    )
    expect(document.title).toBe("Acme · a6n CRM")
    expect(screen.getByRole("link", { name: "Inquiries" })).toHaveAttribute("href", "/inquiries")
  })
})
