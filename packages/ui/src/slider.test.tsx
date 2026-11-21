// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Slider } from "./slider"

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

describe("Slider", () => {
  it("renders one slider role per value", () => {
    render(<Slider defaultValue={[20, 80]} />)
    const thumbs = screen.getAllByRole("slider")
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0]).toHaveValue("20")
    expect(thumbs[1]).toHaveValue("80")
  })

  it("arrow keys step the value and onValueChange gets number[]", () => {
    const onValueChange = vi.fn()
    render(<Slider defaultValue={[50]} min={0} max={100} step={5} onValueChange={onValueChange} />)
    const thumb = screen.getByRole("slider")
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]![0]).toEqual([55])
    expect(thumb).toHaveValue("55")
    fireEvent.keyDown(thumb, { key: "ArrowLeft" })
    expect(onValueChange.mock.calls[1]![0]).toEqual([50])
  })

  it("controlled value does not move without the parent", () => {
    render(<Slider value={[30]} onValueChange={() => {}} />)
    const thumb = screen.getByRole("slider")
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    expect(thumb).toHaveValue("30")
  })

  it("onValueCommit fires with number[] after a key interaction", () => {
    const onValueCommit = vi.fn()
    render(<Slider defaultValue={[10]} onValueCommit={onValueCommit} />)
    const thumb = screen.getByRole("slider")
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    fireEvent.keyUp(thumb, { key: "ArrowRight" })
    expect(onValueCommit.mock.calls[0]![0]).toEqual([11])
  })

  it("honours min, max and step", () => {
    render(<Slider defaultValue={[0]} min={-10} max={10} step={2} />)
    const thumb = screen.getByRole("slider")
    expect(thumb).toHaveAttribute("min", "-10")
    expect(thumb).toHaveAttribute("max", "10")
  })

  it("disabled blocks keyboard changes", () => {
    const onValueChange = vi.fn()
    render(<Slider defaultValue={[10]} disabled onValueChange={onValueChange} />)
    const thumb = screen.getByRole("slider")
    fireEvent.keyDown(thumb, { key: "ArrowRight" })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("keeps the data-slot hooks and vertical orientation", () => {
    const { container } = render(<Slider defaultValue={[10]} orientation="vertical" className="h-40" />)
    const root = container.querySelector('[data-slot="slider"]')
    expect(root).toHaveClass("h-40")
    expect(container.querySelector('[data-slot="slider-track"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="slider-indicator"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(1)
    expect(root).toHaveAttribute("data-orientation", "vertical")
  })
})
