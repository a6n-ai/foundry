// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { RadioGroup, RadioGroupItem } from "./radio-group"

beforeAll(() => {
  Element.prototype.getAnimations = () => []
})

afterEach(cleanup)

function Plans(props: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup aria-label="Plan" {...props}>
      <RadioGroupItem value="a" aria-label="Alpha" />
      <RadioGroupItem value="b" aria-label="Beta" />
      <RadioGroupItem value="c" aria-label="Gamma" disabled />
    </RadioGroup>
  )
}

describe("RadioGroup", () => {
  it("renders a radiogroup of named radios with slots", () => {
    render(<Plans defaultValue="a" />)
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toHaveAttribute("data-slot", "radio-group")
    const alpha = screen.getByRole("radio", { name: "Alpha" })
    expect(alpha).toHaveAttribute("data-slot", "radio")
    expect(alpha.querySelector('[data-slot="radio-indicator"]')).not.toBeNull()
  })

  it("emits data-checked / data-unchecked, not data-state", () => {
    render(<Plans value="b" />)
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute("data-checked")
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("data-unchecked")
    expect(screen.getByRole("radio", { name: "Beta" })).not.toHaveAttribute("data-state")
  })

  it("selects on click when uncontrolled and calls onValueChange with a string", () => {
    const onChange = vi.fn()
    render(<Plans onValueChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }))
    expect(onChange.mock.calls[0][0]).toBe("b")
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute("aria-checked", "true")
  })

  it("stays put when controlled and the parent ignores the change", () => {
    const onChange = vi.fn()
    render(<Plans value="a" onValueChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }))
    expect(onChange.mock.calls[0][0]).toBe("b")
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("aria-checked", "true")
  })

  it("moves selection with arrow keys and skips disabled radios", () => {
    const onChange = vi.fn()
    render(<Plans defaultValue="a" onValueChange={onChange} />)
    const alpha = screen.getByRole("radio", { name: "Alpha" })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: "ArrowDown" })
    expect(onChange.mock.calls[0][0]).toBe("b")
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole("radio", { name: "Beta" }), { key: "ArrowDown" })
    expect(onChange.mock.calls[1][0]).toBe("a")
  })

  it("ignores clicks on a disabled radio", () => {
    const onChange = vi.fn()
    render(<Plans onValueChange={onChange} />)
    const gamma = screen.getByRole("radio", { name: "Gamma" })
    fireEvent.click(gamma)
    expect(gamma).toHaveAttribute("data-disabled")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("replaces an item element through render", () => {
    render(
      <RadioGroup aria-label="x" defaultValue="a">
        <RadioGroupItem value="a" render={<button type="button" data-custom aria-label="Custom" />} />
      </RadioGroup>
    )
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("data-custom")
  })
})
