// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

afterEach(cleanup)

const items = (
  <>
    <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
    <ToggleGroupItem value="b">Beta</ToggleGroupItem>
    <ToggleGroupItem value="c" disabled>Gamma</ToggleGroupItem>
  </>
)

describe("ToggleGroup", () => {
  it("renders a named group of items with slots and variant attrs", () => {
    render(<ToggleGroup type="single" variant="outline" size="sm" aria-label="Pick">{items}</ToggleGroup>)
    const group = screen.getByRole("group", { name: "Pick" })
    expect(group).toHaveAttribute("data-slot", "toggle-group")
    expect(group).toHaveAttribute("data-variant", "outline")
    const alpha = screen.getByText("Alpha")
    expect(alpha).toHaveAttribute("data-slot", "toggle")
    expect(alpha).toHaveAttribute("data-variant", "outline")
    expect(alpha).toHaveAttribute("data-size", "sm")
  })

  it("single: string value, data-pressed on the active item, deselect reports an empty string", () => {
    const onChange = vi.fn()
    render(<ToggleGroup type="single" value="a" onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    const alpha = screen.getByText("Alpha")
    expect(alpha).toHaveAttribute("data-pressed")
    expect(alpha).not.toHaveAttribute("data-state")
    expect(screen.getByText("Beta")).not.toHaveAttribute("data-pressed")
    fireEvent.click(screen.getByText("Beta"))
    expect(onChange.mock.calls[0][0]).toBe("b")
    fireEvent.click(alpha)
    expect(onChange.mock.calls[1][0]).toBe("")
  })

  it("single: uncontrolled defaultValue selects and replaces", () => {
    render(<ToggleGroup type="single" defaultValue="a" aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Beta"))
    expect(screen.getByText("Beta")).toHaveAttribute("data-pressed")
    expect(screen.getByText("Alpha")).not.toHaveAttribute("data-pressed")
  })

  it("single: stays put when controlled and the parent ignores the change", () => {
    const onChange = vi.fn()
    render(<ToggleGroup type="single" value="" onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Alpha"))
    expect(onChange.mock.calls[0][0]).toBe("a")
    expect(screen.getByText("Alpha")).not.toHaveAttribute("data-pressed")
  })

  it("multiple: array value, several items pressed", () => {
    const onChange = vi.fn()
    render(<ToggleGroup type="multiple" value={["a"]} onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Beta"))
    expect(onChange.mock.calls[0][0]).toEqual(["a", "b"])
    fireEvent.click(screen.getByText("Alpha"))
    expect(onChange.mock.calls[1][0]).toEqual([])
  })

  it("accepts ui-sdk props directly: multiple and an array value", () => {
    const onChange = vi.fn()
    render(<ToggleGroup multiple defaultValue={["a"]} onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Beta"))
    expect(onChange.mock.calls[0][0]).toEqual(["a", "b"])
  })

  it("moves focus with arrow keys and skips nothing but stays in the group", () => {
    render(<ToggleGroup type="single" defaultValue="a" aria-label="Pick">{items}</ToggleGroup>)
    const alpha = screen.getByText("Alpha")
    alpha.focus()
    fireEvent.keyDown(alpha, { key: "ArrowRight" })
    expect(screen.getByText("Beta")).toHaveFocus()
  })

  // Space on a native button is activated by the browser (jsdom never synthesizes the click), so the part must not cancel it
  it("leaves Space to the native button", () => {
    render(<ToggleGroup type="single" aria-label="Pick">{items}</ToggleGroup>)
    const beta = screen.getByText("Beta")
    beta.focus()
    expect(beta.tagName).toBe("BUTTON")
    expect(fireEvent.keyDown(beta, { key: " " })).toBe(true)
    expect(fireEvent.keyUp(beta, { key: " " })).toBe(true)
  })

  it("ignores clicks on a disabled item and on a disabled group", () => {
    const onChange = vi.fn()
    const { rerender } = render(<ToggleGroup type="single" onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Gamma"))
    expect(onChange).not.toHaveBeenCalled()
    rerender(<ToggleGroup type="single" disabled onValueChange={onChange} aria-label="Pick">{items}</ToggleGroup>)
    fireEvent.click(screen.getByText("Alpha"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("replaces an item element through render", () => {
    render(
      <ToggleGroup type="single" aria-label="Pick">
        <ToggleGroupItem value="a" render={<button type="button" data-custom />}>Custom</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(screen.getByText("Custom")).toHaveAttribute("data-slot", "toggle")
    expect(screen.getByText("Custom")).toHaveAttribute("data-custom")
  })
})
