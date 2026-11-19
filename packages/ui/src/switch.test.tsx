// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Switch, SwitchThumb } from "./switch"

afterEach(cleanup)

describe("Switch", () => {
  it("renders a switch with a default thumb", () => {
    render(<Switch aria-label="Auto-renew" />)
    const sw = screen.getByRole("switch", { name: "Auto-renew" })
    expect(sw).toHaveAttribute("data-slot", "switch")
    expect(sw).toHaveAttribute("data-size", "default")
    expect(sw.querySelectorAll('[data-slot="switch-thumb"]')).toHaveLength(1)
  })

  it("toggles when uncontrolled", () => {
    render(<Switch aria-label="a" />)
    const sw = screen.getByRole("switch")
    fireEvent.click(sw)
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(sw).toHaveAttribute("data-checked")
  })

  it("stays unchecked when controlled and the parent ignores the change", () => {
    const onChange = vi.fn()
    render(<Switch aria-label="a" checked={false} onCheckedChange={onChange} />)
    fireEvent.click(screen.getByRole("switch"))
    expect(onChange).toHaveBeenCalledWith(true, expect.anything())
    expect(screen.getByRole("switch")).toHaveAttribute("data-unchecked")
  })

  it("toggles from a label with htmlFor", () => {
    render(
      <>
        <label htmlFor="sw-1">Weekends</label>
        <Switch id="sw-1" />
      </>
    )
    fireEvent.click(screen.getByText("Weekends"))
    expect(screen.getByRole("switch", { name: "Weekends" })).toHaveAttribute("aria-checked", "true")
  })

  it("ignores clicks when disabled", () => {
    render(<Switch aria-label="a" disabled />)
    const sw = screen.getByRole("switch")
    fireEvent.click(sw)
    expect(sw).toHaveAttribute("data-disabled")
    expect(sw).toHaveAttribute("aria-checked", "false")
  })

  it("submits name=value only while checked", () => {
    const { container, rerender } = render(
      <form>
        <Switch aria-label="a" name="notify" value="yes" defaultChecked />
      </form>
    )
    expect(new FormData(container.querySelector("form")!).get("notify")).toBe("yes")
    rerender(
      <form>
        <Switch aria-label="a" name="notify" value="yes" checked={false} />
      </form>
    )
    expect(new FormData(container.querySelector("form")!).get("notify")).toBeNull()
  })

  it("styles the thumb with theme tokens only, including dark mode", () => {
    render(<Switch aria-label="a" />)
    const thumb = screen.getByRole("switch").querySelector('[data-slot="switch-thumb"]')!
    expect(thumb.className).not.toMatch(/rgb\(|#[0-9a-f]{3,8}\b/i)
    expect(thumb).toHaveClass("dark:data-checked:bg-primary-foreground", "dark:data-unchecked:bg-foreground")
  })

  it("uses custom children instead of the default thumb", () => {
    render(
      <Switch aria-label="a" size="sm">
        <SwitchThumb className="custom" />
      </Switch>
    )
    const thumbs = screen.getByRole("switch").querySelectorAll('[data-slot="switch-thumb"]')
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]).toHaveClass("custom")
    expect(screen.getByRole("switch")).toHaveAttribute("data-size", "sm")
  })
})
