// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Label } from "./label"

afterEach(cleanup)

describe("Label", () => {
  it("renders a label with slot, classes and className", () => {
    render(<Label htmlFor="x" className="custom">Name</Label>)
    const el = screen.getByText("Name")
    expect(el.tagName).toBe("LABEL")
    expect(el).toHaveAttribute("data-slot", "label")
    expect(el).toHaveClass("select-none", "custom")
  })

  it("names a control by htmlFor", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>
    )
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument()
  })

  it("activates a control a native label cannot reach", async () => {
    const onClick = vi.fn()
    render(
      <>
        <Label htmlFor="c">Notify</Label>
        <div id="c" role="checkbox" aria-checked="false" tabIndex={0} onClick={onClick} />
      </>
    )
    expect(await screen.findByRole("checkbox", { name: "Notify" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Notify"))
    expect(onClick).toHaveBeenCalled()
  })

  it("toggles a checkbox it wraps", () => {
    render(
      <Label>
        Agree
        <input type="checkbox" />
      </Label>
    )
    fireEvent.click(screen.getByText("Agree"))
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("prevents text selection on double click", () => {
    render(<Label htmlFor="x">Name</Label>)
    const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true, detail: 2 })
    screen.getByText("Name").dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})
