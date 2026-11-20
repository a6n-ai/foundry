// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState, type ComponentProps } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

function Settings(props: ComponentProps<typeof Tabs>) {
  return (
    <Tabs {...props}>
      <TabsList aria-label="Settings">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Manage your profile.</TabsContent>
      <TabsContent value="password">Choose a new password.</TabsContent>
      <TabsContent value="billing">Invoices.</TabsContent>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("renders a named tablist with tabs and the selected panel", () => {
    render(<Settings defaultValue="account" />)

    expect(screen.getByRole("tablist", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("data-selected")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Manage your profile.")
  })

  it("moves the selection with the arrow keys", () => {
    render(<Settings defaultValue="account" />)
    const account = screen.getByRole("tab", { name: "Account" })

    account.focus()
    fireEvent.keyDown(account, { key: "ArrowRight" })

    expect(screen.getByRole("tab", { name: "Password" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Choose a new password.")
  })

  it("round-trips a controlled value through onValueChange", () => {
    const onValueChange = vi.fn()
    function Controlled() {
      const [value, setValue] = useState("account")
      return (
        <>
          <p>selected:{value}</p>
          <Settings
            value={value}
            onValueChange={(next) => {
              onValueChange(next)
              setValue(next as string)
            }}
          />
        </>
      )
    }
    render(<Controlled />)

    fireEvent.click(screen.getByRole("tab", { name: "Billing" }))

    expect(onValueChange).toHaveBeenCalledWith("billing")
    expect(screen.getByText("selected:billing")).toBeInTheDocument()
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Invoices.")
  })

  it("renders a sliding indicator in the line variant", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList variant="line" aria-label="Lines">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    expect(container.querySelector('[data-slot="tabs-indicator"]')).toBeInTheDocument()
  })

  it("does not render an indicator in the default variant", () => {
    const { container } = render(<Settings defaultValue="account" />)

    expect(container.querySelector('[data-slot="tabs-indicator"]')).toBeNull()
  })

  it("renders link tabs as links and follows the selected value from the URL", () => {
    const links = (value: string) => (
      <Tabs value={value}>
        <TabsList variant="line" aria-label="Orders">
          <TabsTrigger value="all" render={<a href="/orders" />}>
            All orders
          </TabsTrigger>
          <TabsTrigger value="lookout" render={<a href="/orders?view=lookout" />}>
            Look out for
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )
    const { rerender } = render(links("all"))

    const all = screen.getByRole("tab", { name: "All orders" })
    expect(all.tagName).toBe("A")
    expect(all).toHaveAttribute("href", "/orders")
    expect(all).toHaveAttribute("aria-selected", "true")

    rerender(links("lookout"))

    expect(screen.getByRole("tab", { name: "Look out for" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "All orders" })).toHaveAttribute("aria-selected", "false")
  })

  it("styles the list and triggers with the shared type and rule tokens", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList variant="line" aria-label="Tokens">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    expect(screen.getByRole("tablist")).toHaveClass("border-b-(length:--ui-tabs-rule-width)")
    expect(screen.getByRole("tab", { name: "A" })).toHaveClass("text-(length:--ui-tabs-size)")
    expect(screen.getByRole("tab", { name: "A" })).toHaveClass("font-(weight:--ui-tabs-weight)")
  })
})
