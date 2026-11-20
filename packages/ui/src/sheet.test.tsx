// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
  }
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
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    })
  )
})

afterEach(cleanup)

function Filters({ side }: { side?: "left" | "right" | "top" | "bottom" }) {
  return (
    <Sheet side={side}>
      <SheetTrigger>Filters</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter orders</SheetTitle>
          <SheetDescription>Only matching orders stay in the list.</SheetDescription>
        </SheetHeader>
        <SheetClose>Apply</SheetClose>
      </SheetContent>
    </Sheet>
  )
}

describe("Sheet", () => {
  it("opens from its trigger and names the sheet by its title", () => {
    render(<Filters />)
    const trigger = screen.getByRole("button", { name: "Filters" })
    expect(trigger).toHaveAttribute("data-slot", "drawer-trigger")
    fireEvent.click(trigger)
    const sheet = screen.getByRole("dialog", { name: "Filter orders" })
    expect(sheet).toHaveAttribute("data-slot", "drawer-content")
    expect(sheet).toHaveAttribute("data-open")
    expect(sheet).toHaveTextContent("Only matching orders stay in the list.")
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Filters />)
    const trigger = screen.getByRole("button", { name: "Filters" })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Filter orders" }), { key: "Escape" })
    act(() => {})
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("moves focus into the sheet", async () => {
    render(<Filters />)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    const sheet = screen.getByRole("dialog", { name: "Filter orders" })
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))
  })

  it("takes its edge from the side prop on Sheet", () => {
    render(<Filters side="bottom" />)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    expect(screen.getByRole("dialog", { name: "Filter orders" })).toHaveAttribute("data-side", "bottom")
  })

  it("renders the trigger as the element passed to render", () => {
    render(
      <Sheet>
        <SheetTrigger render={<a href="/menu" />}>Menu</SheetTrigger>
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    expect(screen.getByRole("link", { name: "Menu" })).toHaveAttribute("data-slot", "drawer-trigger")
  })

  it("styles the content with theme tokens and no transition-all", () => {
    render(<Filters />)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    const sheet = screen.getByRole("dialog", { name: "Filter orders" })
    expect(sheet.className).not.toMatch(/transition-all|rgb\(|#[0-9a-f]{3,8}\b/i)
    expect(sheet).toHaveClass("bg-popover", "shadow-lg")
    expect(sheet.outerHTML).not.toContain("data-state")
  })
})
