// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Checkbox } from "./checkbox"

beforeAll(() => {
  Element.prototype.getAnimations = () => []
})

afterEach(cleanup)

describe("Checkbox", () => {
  it("renders a named checkbox with an indicator slot", () => {
    render(<Checkbox aria-label="Agree" defaultChecked />)
    const box = screen.getByRole("checkbox", { name: "Agree" })
    expect(box).toHaveAttribute("data-slot", "checkbox")
    expect(box.querySelector('[data-slot="checkbox-indicator"]')).not.toBeNull()
  })

  it("emits ui-sdk state attributes, not data-state", () => {
    const { rerender } = render(<Checkbox aria-label="a" checked={false} />)
    const box = screen.getByRole("checkbox")
    expect(box).toHaveAttribute("data-unchecked")
    expect(box).not.toHaveAttribute("data-state")
    rerender(<Checkbox aria-label="a" checked />)
    expect(box).toHaveAttribute("data-checked")
    rerender(<Checkbox aria-label="a" checked="indeterminate" />)
    expect(box).toHaveAttribute("data-indeterminate")
    expect(box).toHaveAttribute("aria-checked", "mixed")
  })

  it("toggles when uncontrolled and calls onCheckedChange with the new value", () => {
    const onChange = vi.fn()
    render(<Checkbox aria-label="a" onCheckedChange={onChange} />)
    const box = screen.getByRole("checkbox")
    fireEvent.click(box)
    expect(box).toHaveAttribute("data-checked")
    expect(onChange.mock.calls[0][0]).toBe(true)
    fireEvent.click(box)
    expect(onChange.mock.calls[1][0]).toBe(false)
  })

  it("stays put when controlled and the parent ignores the change", () => {
    const onChange = vi.fn()
    render(<Checkbox aria-label="a" checked={false} onCheckedChange={onChange} />)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onChange.mock.calls[0][0]).toBe(true)
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-unchecked")
  })

  // Space on a native button is activated by the browser (jsdom never synthesizes the click), so the part must not cancel it
  it("leaves Space to the native button", () => {
    render(<Checkbox aria-label="a" />)
    const box = screen.getByRole("checkbox")
    box.focus()
    expect(box.tagName).toBe("BUTTON")
    expect(fireEvent.keyDown(box, { key: " " })).toBe(true)
    expect(fireEvent.keyUp(box, { key: " " })).toBe(true)
  })

  it("ignores clicks when disabled", () => {
    const onChange = vi.fn()
    render(<Checkbox aria-label="a" disabled onCheckedChange={onChange} />)
    const box = screen.getByRole("checkbox")
    fireEvent.click(box)
    expect(box).toHaveAttribute("data-disabled")
    expect(onChange).not.toHaveBeenCalled()
  })
})
