// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"

beforeAll(() => {
  Element.prototype.getAnimations = () => []
})
afterEach(cleanup)

describe("Collapsible", () => {
  it("is closed by default: aria-expanded false, content not rendered", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden stuff</CollapsibleContent>
      </Collapsible>
    )
    const trigger = screen.getByRole("button", { name: "More" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("data-slot", "collapsible-trigger")
    expect(screen.queryByText("Hidden stuff")).toBeNull()
  })

  it("opens and closes uncontrolled", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden stuff</CollapsibleContent>
      </Collapsible>
    )
    const trigger = screen.getByRole("button", { name: "More" })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("data-open")
    expect(trigger).not.toHaveAttribute("data-state")
    expect(screen.getByText("Hidden stuff")).toBeVisible()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("honours defaultOpen", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Shown</CollapsibleContent>
      </Collapsible>
    )
    expect(screen.getByText("Shown")).toBeVisible()
  })

  it("controlled: onOpenChange gets a boolean and the parent decides", () => {
    const onOpenChange = vi.fn()
    render(
      <Collapsible open={false} onOpenChange={onOpenChange}>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden stuff</CollapsibleContent>
      </Collapsible>
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())
    expect(screen.queryByText("Hidden stuff")).toBeNull()
  })

  it("controlled open round-trips through state", () => {
    function Host() {
      const [open, setOpen] = React.useState(false)
      return (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger>More</CollapsibleTrigger>
          <CollapsibleContent>Body</CollapsibleContent>
        </Collapsible>
      )
    }
    render(<Host />)
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getByText("Body")).toBeVisible()
  })

  it("disabled blocks the trigger", () => {
    render(
      <Collapsible disabled>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>Hidden stuff</CollapsibleContent>
      </Collapsible>
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.queryByText("Hidden stuff")).toBeNull()
  })

  it("trigger asChild renders the child element", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <a href="#x">Toggle</a>
        </CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    )
    const link = screen.getByText("Toggle")
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("aria-expanded", "false")
  })

  it("root render replaces the element", () => {
    render(
      <Collapsible render={<aside data-testid="root" />}>
        <CollapsibleTrigger>More</CollapsibleTrigger>
      </Collapsible>
    )
    const root = screen.getByTestId("root")
    expect(root.tagName).toBe("ASIDE")
    expect(root).toHaveAttribute("data-slot", "collapsible")
  })

  it("keepMounted keeps closed content in the page, hidden", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent keepMounted>Kept</CollapsibleContent>
      </Collapsible>
    )
    expect(screen.getByText("Kept", { exact: false })).not.toBeVisible()
    expect(screen.getByText("Kept")).toHaveAttribute("data-closed")
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getByText("Kept")).toBeVisible()
  })

  it("content passes id and className through", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleContent id="panel-1" className="pt-2">
          Body
        </CollapsibleContent>
      </Collapsible>
    )
    const panel = screen.getByText("Body")
    expect(panel).toHaveAttribute("id", "panel-1")
    expect(panel).toHaveAttribute("data-slot", "collapsible-panel")
    expect(panel).toHaveClass("pt-2")
  })
})
