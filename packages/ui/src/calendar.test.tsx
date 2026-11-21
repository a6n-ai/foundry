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

const oct = (d: number) => new Date(2026, 9, d)
const cell = (name: string) => screen.getByRole("gridcell", { name })

describe("Calendar", () => {
  it("selects a single day and reports it as a local Date", () => {
    const onSelect = vi.fn()
    render(<Calendar mode="single" defaultMonth={oct(1)} onSelect={onSelect} />)
    fireEvent.click(cell("Friday, October 16, 2026"))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0]).toEqual(oct(16))
    expect(onSelect.mock.calls[0]![1]).toEqual(oct(16))
  })

  it("reports undefined and the day when the selected day is pressed again", () => {
    const onSelect = vi.fn()
    render(<Calendar mode="single" selected={oct(16)} onSelect={onSelect} />)
    fireEvent.click(cell("Friday, October 16, 2026"))
    expect(onSelect).toHaveBeenCalledWith(undefined, oct(16))
  })

  it("shows the controlled selection", () => {
    render(<Calendar mode="single" selected={oct(16)} />)
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("aria-selected", "true")
    expect(cell("Saturday, October 17, 2026")).toHaveAttribute("aria-selected", "false")
  })

  it("starts a range on the first press and finishes it on the second", () => {
    const onSelect = vi.fn()
    render(<Calendar mode="range" defaultMonth={oct(1)} onSelect={onSelect} />)
    fireEvent.click(cell("Monday, October 5, 2026"))
    expect(onSelect).toHaveBeenLastCalledWith({ from: oct(5), to: undefined }, oct(5))
    fireEvent.click(cell("Friday, October 9, 2026"))
    expect(onSelect).toHaveBeenLastCalledWith({ from: oct(5), to: oct(9) }, oct(9))
  })

  it("marks the range ends and the days between", () => {
    render(<Calendar mode="range" selected={{ from: oct(5), to: oct(8) }} />)
    expect(cell("Monday, October 5, 2026")).toHaveAttribute("data-range-start")
    expect(cell("Tuesday, October 6, 2026")).toHaveAttribute("data-range-middle")
    expect(cell("Thursday, October 8, 2026")).toHaveAttribute("data-range-end")
  })

  it("shows a half-picked controlled range as its start", () => {
    render(<Calendar mode="range" selected={{ from: oct(5), to: undefined }} />)
    expect(cell("Monday, October 5, 2026")).toHaveAttribute("aria-selected", "true")
    expect(cell("Tuesday, October 6, 2026")).toHaveAttribute("aria-selected", "false")
  })

  it("keeps a matcher-disabled day from being picked", () => {
    const onSelect = vi.fn()
    render(<Calendar mode="single" defaultMonth={oct(1)} disabled={(d) => d.getDay() === 1} onSelect={onSelect} />)
    const monday = cell("Monday, October 5, 2026")
    expect(monday).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(monday)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("disables days before and after a bound", () => {
    render(<Calendar mode="single" defaultMonth={oct(1)} disabled={[{ before: oct(10) }, { after: oct(20) }]} />)
    expect(cell("Friday, October 9, 2026")).toHaveAttribute("aria-disabled", "true")
    expect(cell("Saturday, October 10, 2026")).not.toHaveAttribute("aria-disabled", "true")
    expect(cell("Wednesday, October 21, 2026")).toHaveAttribute("aria-disabled", "true")
  })

  it("starts the week on weekStartsOn", () => {
    render(<Calendar mode="single" defaultMonth={oct(1)} weekStartsOn={1} />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("Monday")
  })

  it("reports every pressed day to onDayClick and names days in the locale", () => {
    const onDayClick = vi.fn()
    render(<Calendar mode="range" defaultMonth={oct(1)} locale={{ code: "fr" }} weekStartsOn={1} onDayClick={onDayClick} />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("lundi")
    fireEvent.click(screen.getByRole("gridcell", { name: / 5 octobre 2026$/ }))
    expect(onDayClick).toHaveBeenLastCalledWith(oct(5))
  })

  it("turns months with Previous and Next and reports them as Dates", () => {
    const onMonthChange = vi.fn()
    render(<Calendar mode="single" defaultMonth={oct(1)} onMonthChange={onMonthChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Next month" }))
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument()
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(2026, 10, 1))
  })

  it("follows a controlled month", () => {
    render(<Calendar mode="single" month={new Date(2027, 0, 20)} />)
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeInTheDocument()
  })

  it("shows numberOfMonths grids", () => {
    render(<Calendar mode="range" defaultMonth={oct(1)} numberOfMonths={2} />)
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument()
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument()
  })

  it("selects the focused day with the keyboard", () => {
    const onSelect = vi.fn()
    render(<Calendar mode="single" selected={oct(16)} onSelect={onSelect} />)
    const start = cell("Friday, October 16, 2026")
    start.focus()
    fireEvent.keyDown(start, { key: "ArrowRight" })
    const next = cell("Saturday, October 17, 2026")
    expect(next).toHaveFocus()
    fireEvent.keyDown(next, { key: "Enter" })
    expect(onSelect).toHaveBeenLastCalledWith(oct(17), oct(17))
  })

  it("focuses a day on mount with autoFocus", async () => {
    render(<Calendar mode="single" selected={oct(16)} autoFocus />)
    await waitFor(() => expect(cell("Friday, October 16, 2026")).toHaveFocus())
  })

  it("is a ui-sdk calendar: slots, state attributes, no data-state", () => {
    const { container } = render(<Calendar mode="single" selected={oct(16)} className="w-full p-0" />)
    const root = container.querySelector("[data-slot=calendar]")
    expect(root).toHaveClass("w-full", "p-0")
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("data-slot", "calendar-day")
    expect(cell("Friday, October 16, 2026")).toHaveAttribute("data-selected")
    expect(container.querySelector("[data-state]")).toBeNull()
  })
})
