// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

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

function tabTo(element: HTMLElement) {
  fireEvent.keyDown(document.body, { key: "Tab" })
  act(() => element.focus())
}

describe("Tooltip", () => {
  it("renders a trigger and a closed content with the tooltip role", () => {
    render(
      <Tooltip>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    const trigger = screen.getByRole("button", { name: "Save" })
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger")
    const content = screen.getByRole("tooltip", { hidden: true })
    expect(content).toHaveAttribute("data-slot", "tooltip-content")
    expect(content).toHaveAttribute("data-closed")
    expect(content).not.toHaveAttribute("data-open")
  })

  it("renders the content in place, not in a portal", () => {
    const { container } = render(
      <Tooltip>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    expect(container).toContainElement(screen.getByRole("tooltip", { hidden: true }))
  })

  it("works without a provider", () => {
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open")
  })

  it("opens on keyboard focus, closes on Escape and leaves focus on the trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    const trigger = screen.getByRole("button", { name: "Save" })
    tabTo(trigger)
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open")
    fireEvent.keyDown(trigger, { key: "Escape" })
    expect(screen.getByRole("tooltip", { hidden: true })).not.toHaveAttribute("data-open")
    expect(trigger).toHaveFocus()
  })

  it("opens on hover after 150 ms", () => {
    vi.useFakeTimers()
    try {
      vi.advanceTimersByTime(10_000)
      render(
        <Tooltip>
          <TooltipTrigger aria-label="Save">S</TooltipTrigger>
          <TooltipContent>Save</TooltipContent>
        </Tooltip>
      )
      const trigger = screen.getByRole("button", { name: "Save" })
      fireEvent.pointerEnter(trigger, { pointerType: "mouse" })
      act(() => vi.advanceTimersByTime(149))
      expect(screen.getByRole("tooltip", { hidden: true })).not.toHaveAttribute("data-open")
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole("tooltip")).toHaveAttribute("data-open")
    } finally {
      vi.useRealTimers()
    }
  })

  it("names an icon-only trigger from its tooltip text", async () => {
    render(
      <Tooltip>
        <TooltipTrigger>
          <span aria-hidden="true">+</span>
        </TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>
    )
    expect(await screen.findByRole("button", { name: "Add to library" })).toBeInTheDocument()
  })

  it("follows a controlled open and reports the request to the parent", () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <Tooltip open={false} onOpenChange={onOpenChange}>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    tabTo(screen.getByRole("button", { name: "Save" }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())
    expect(screen.getByRole("tooltip", { hidden: true })).not.toHaveAttribute("data-open")
    rerender(
      <Tooltip open onOpenChange={onOpenChange}>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open")
  })

  it("draws an arrow inside the content that points at the trigger", () => {
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    const content = screen.getByRole("tooltip")
    expect(content.querySelector('[data-slot="tooltip-arrow"]')).toHaveAttribute("data-side")
  })

  it("renders the trigger as the element passed to render", () => {
    render(
      <Tooltip>
        <TooltipTrigger render={<a href="/changelog" />}>Changelog</TooltipTrigger>
        <TooltipContent>See what's new</TooltipContent>
      </Tooltip>
    )
    expect(screen.getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "/changelog")
  })

  it("styles the content with theme tokens and state attributes only", () => {
    render(
      <Tooltip>
        <TooltipTrigger aria-label="Save">S</TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    const content = screen.getByRole("tooltip", { hidden: true })
    expect(content.className).not.toMatch(/rgb\(|#[0-9a-f]{3,8}\b|transition-all/i)
    expect(content).toHaveClass(
      "rounded-(--ui-tooltip-radius)",
      "p-(--ui-tooltip-padding)",
      "bg-foreground",
      "text-background",
      "duration-150",
      "ease-soft",
      "motion-reduce:transition-none",
      "data-starting-style:opacity-0",
      "data-ending-style:opacity-0"
    )
    expect(content.outerHTML).not.toContain("data-state")
  })
})
