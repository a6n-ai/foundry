// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar"

beforeAll(() => {
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const cell = (name: string) => screen.getByRole("gridcell", { name })

describe("Calendar", () => {
  it("selects a single day and reports it as an ISO date", () => {
    const onValueChange = vi.fn()
    render(<Calendar defaultMonth="2026-10" onValueChange={onValueChange} />)
    fireEvent.click(cell("Friday, October 16, 2026"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]![0]).toBe("2026-10-16")
  })

  it("reports null when the selected day is pressed again", () => {
    const onValueChange = vi.fn()
    render(<Calendar value="2026-10-16" onValueChange={onValueChange} />)
    fireEvent.click(cell("Friday, October 16, 2026"))
    expect(onValueChange.mock.calls[0]![0]).toBeNull()
  })

  it("shows the controlled selection", () => {
    render(<Calendar value="2026-10-16" />)
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("aria-selected", "true")
    expect(cell("Saturday, October 17, 2026")).toHaveAttribute("aria-selected", "false")
  })

  it("starts a range on the first press and finishes it on the second", () => {
    const onAnchorChange = vi.fn()
    const onValueChange = vi.fn()
    render(<Calendar mode="range" defaultMonth="2026-10" onAnchorChange={onAnchorChange} onValueChange={onValueChange} />)
    fireEvent.click(cell("Monday, October 5, 2026"))
    expect(onAnchorChange.mock.calls[0]![0]).toBe("2026-10-05")
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.click(cell("Friday, October 9, 2026"))
    expect(onValueChange.mock.calls[0]![0]).toEqual(["2026-10-05", "2026-10-09"])
  })

  it("marks the range ends and the days between", () => {
    render(<Calendar mode="range" value={["2026-10-05", "2026-10-08"]} />)
    expect(cell("Monday, October 5, 2026")).toHaveAttribute("data-range-start")
    expect(cell("Tuesday, October 6, 2026")).toHaveAttribute("data-range-middle")
    expect(cell("Thursday, October 8, 2026")).toHaveAttribute("data-range-end")
  })

  it("keeps an unavailable day from being picked", () => {
    const onValueChange = vi.fn()
    render(<Calendar defaultMonth="2026-10" unavailable={(iso) => new Date(`${iso}T00:00:00`).getDay() === 1} onValueChange={onValueChange} />)
    const monday = cell("Monday, October 5, 2026")
    expect(monday).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(monday)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("disables days before and after a bound", () => {
    render(<Calendar defaultMonth="2026-10" unavailable={[{ before: "2026-10-10" }, { after: "2026-10-20" }]} />)
    expect(cell("Friday, October 9, 2026")).toHaveAttribute("aria-disabled", "true")
    expect(cell("Saturday, October 10, 2026")).not.toHaveAttribute("aria-disabled", "true")
    expect(cell("Wednesday, October 21, 2026")).toHaveAttribute("aria-disabled", "true")
  })

  it("starts the week on weekStartsOn", () => {
    render(<Calendar defaultMonth="2026-10" weekStartsOn={1} />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("Monday")
  })

  it("names days in the locale", () => {
    render(<Calendar defaultMonth="2026-10" locale="fr" weekStartsOn={1} />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("lundi")
  })

  it("turns months with Previous and Next and reports them as ISO months", () => {
    const onMonthChange = vi.fn()
    render(<Calendar defaultMonth="2026-10" onMonthChange={onMonthChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Next month" }))
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument()
    expect(onMonthChange.mock.calls.at(-1)![0]).toBe("2026-11")
  })

  it("follows a controlled month", () => {
    render(<Calendar month="2027-01" />)
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeInTheDocument()
  })

  it("shows months grids", () => {
    render(<Calendar mode="range" defaultMonth="2026-10" months={2} />)
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument()
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument()
  })

  it("selects the focused day with the keyboard", () => {
    const onValueChange = vi.fn()
    render(<Calendar value="2026-10-16" onValueChange={onValueChange} />)
    const start = cell("Friday, October 16, 2026")
    start.focus()
    fireEvent.keyDown(start, { key: "ArrowRight" })
    const next = cell("Saturday, October 17, 2026")
    expect(next).toHaveFocus()
    fireEvent.keyDown(next, { key: "Enter" })
    expect(onValueChange.mock.calls.at(-1)![0]).toBe("2026-10-17")
  })

  it("focuses a day on mount with autoFocus", async () => {
    render(<Calendar value="2026-10-16" autoFocus />)
    await waitFor(() => expect(cell("Friday, October 16, 2026")).toHaveFocus())
  })

  it("is a ui-sdk calendar: slots, state attributes, no data-state", () => {
    const { container } = render(<Calendar value="2026-10-16" className="w-full p-0" />)
    const root = container.querySelector("[data-slot=calendar]")
    expect(root).toHaveClass("w-full", "p-0")
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("data-slot", "calendar-day")
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("data-selected")
    expect(container.querySelector("[data-state]")).toBeNull()
  })
})
