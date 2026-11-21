// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Toggle, toggleVariants } from "./toggle"

afterEach(cleanup)

describe("Toggle", () => {
  it("renders a named toggle button with a slot", () => {
    render(<Toggle aria-label="Bold">B</Toggle>)
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("data-slot", "toggle")
  })

  it("emits data-pressed and aria-pressed, not data-state", () => {
    const { rerender } = render(<Toggle aria-label="a" pressed={false} />)
    const btn = screen.getByRole("button")
    expect(btn).not.toHaveAttribute("data-pressed")
    expect(btn).not.toHaveAttribute("data-state")
    rerender(<Toggle aria-label="a" pressed />)
    expect(btn).toHaveAttribute("data-pressed")
    expect(btn).toHaveAttribute("aria-pressed", "true")
  })

  it("toggles when uncontrolled and calls onPressedChange with a boolean", () => {
    const onChange = vi.fn()
    render(<Toggle aria-label="a" onPressedChange={onChange} />)
    const btn = screen.getByRole("button")
    fireEvent.click(btn)
    expect(btn).toHaveAttribute("data-pressed")
    expect(onChange.mock.calls[0][0]).toBe(true)
    fireEvent.click(btn)
    expect(onChange.mock.calls[1][0]).toBe(false)
  })

  it("stays put when controlled and the parent ignores the change", () => {
    const onChange = vi.fn()
    render(<Toggle aria-label="a" pressed={false} onPressedChange={onChange} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onChange.mock.calls[0][0]).toBe(true)
    expect(screen.getByRole("button")).not.toHaveAttribute("data-pressed")
  })

  // Space on a native button is activated by the browser (jsdom never synthesizes the click), so the part must not cancel it
  it("leaves Space to the native button", () => {
    render(<Toggle aria-label="a" />)
    const btn = screen.getByRole("button")
    btn.focus()
    expect(btn.tagName).toBe("BUTTON")
    expect(fireEvent.keyDown(btn, { key: " " })).toBe(true)
    expect(fireEvent.keyUp(btn, { key: " " })).toBe(true)
  })

  it("ignores clicks when disabled", () => {
    const onChange = vi.fn()
    render(<Toggle aria-label="a" disabled onPressedChange={onChange} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("keeps Radix asChild working", () => {
    render(
      <Toggle aria-label="x" asChild>
        <a href="/x" data-custom>Link</a>
      </Toggle>
    )
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("data-slot", "toggle")
    expect(link).toHaveAttribute("data-custom")
  })

  it("styles the pressed look from data-pressed, for toggleVariants users too", () => {
    expect(toggleVariants()).toContain("data-pressed:bg-primary/6")
    expect(toggleVariants({ variant: "outline" })).toContain("data-pressed:border-primary/50")
    expect(toggleVariants()).not.toContain("data-[state=on]")
  })
})
