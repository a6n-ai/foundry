// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "./popover"

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
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    })
  )
})

afterEach(cleanup)

describe("Popover", () => {
  it("renders a trigger and a closed content with the dialog role", () => {
    render(
      <Popover>
        <PopoverTrigger>Share</PopoverTrigger>
        <PopoverContent keepMounted>
          <PopoverTitle>Share this document</PopoverTitle>
        </PopoverContent>
      </Popover>
    )
    expect(screen.getByRole("button", { name: "Share" })).toHaveAttribute("data-slot", "popover-trigger")
    const content = screen.getByRole("dialog", { hidden: true })
    expect(content).toHaveAttribute("data-slot", "popover-content")
    expect(content).toHaveAttribute("data-closed")
    expect(content).not.toHaveAttribute("data-open")
  })

  it("renders the content in place, not in a portal", () => {
    const { container } = render(
      <Popover>
        <PopoverTrigger>Share</PopoverTrigger>
        <PopoverContent keepMounted>Body</PopoverContent>
      </Popover>
    )
    expect(container).toContainElement(screen.getByRole("dialog", { hidden: true }))
  })

  it("opens on press, names the dialog by its title and closes on Escape", () => {
    render(
      <Popover>
        <PopoverTrigger>Share</PopoverTrigger>
        <PopoverContent keepMounted>
          <PopoverTitle>Share this document</PopoverTitle>
          <PopoverDescription>Anyone with the link can view it.</PopoverDescription>
        </PopoverContent>
      </Popover>
    )
    const trigger = screen.getByRole("button", { name: "Share" })
    fireEvent.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "Share this document" })
    expect(dialog).toHaveAttribute("data-open")
    expect(dialog).toHaveTextContent("Anyone with the link can view it.")
    fireEvent.keyDown(dialog, { key: "Escape" })
    act(() => {})
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("data-open")
    expect(trigger).toHaveFocus()
  })

  it("keeps a click inside the content away from the row or card around it", () => {
    const onRowClick = vi.fn()
    render(
      <div role="presentation" onClick={onRowClick}>
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <button type="button">Inside</button>
          </PopoverContent>
        </Popover>
      </div>
    )
    fireEvent.click(screen.getByRole("button", { name: "Inside" }))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("renders the trigger as the element passed to render", () => {
    render(
      <Popover>
        <PopoverTrigger render={<a href="/changelog" />}>Changelog</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    )
    expect(screen.getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "/changelog")
  })

  it("styles the content with theme tokens and state attributes only", () => {
    render(
      <Popover>
        <PopoverTrigger>Share</PopoverTrigger>
        <PopoverContent keepMounted>Body</PopoverContent>
      </Popover>
    )
    const content = screen.getByRole("dialog", { hidden: true })
    expect(content.className).not.toMatch(/rgb\(|#[0-9a-f]{3,8}\b|transition-all/i)
    expect(content).toHaveClass(
      "rounded-(--ui-radius-popup)",
      "p-(--ui-popup-padding)",
      "shadow-(--ui-shadow-popup)",
      "bg-popover",
      "duration-150",
      "ease-soft",
      "motion-reduce:transition-none",
      "data-starting-style:opacity-0",
      "data-ending-style:opacity-0"
    )
    expect(content.outerHTML).not.toContain("data-state")
  })
})
