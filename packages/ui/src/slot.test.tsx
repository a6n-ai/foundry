// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Button } from "./button"
import { Slot, Slottable } from "./slot"

afterEach(cleanup)

describe("Slot", () => {
  it("merges className and style onto the child", () => {
    render(
      <Slot className="a" style={{ color: "red", margin: 1 }}>
        <div className="b" style={{ color: "blue" }} data-testid="x" />
      </Slot>
    )
    const el = screen.getByTestId("x")
    expect(el).toHaveClass("a", "b")
    expect(el.style.color).toBe("blue")
    expect(el.style.margin).toBe("1px")
  })

  it("runs the child handler then the slot handler", () => {
    const order: string[] = []
    render(
      <Slot onClick={() => order.push("slot")}>
        <button onClick={() => order.push("child")}>go</button>
      </Slot>
    )
    fireEvent.click(screen.getByRole("button"))
    expect(order).toEqual(["child", "slot"])
  })

  it("still runs the slot handler when the child prevents default, as Radix does", () => {
    const slot = vi.fn()
    render(
      <Slot onClick={slot}>
        <button onClick={(e) => e.preventDefault()}>go</button>
      </Slot>
    )
    fireEvent.click(screen.getByRole("button"))
    expect(slot).toHaveBeenCalledOnce()
  })

  it("hands back React 19 callback-ref cleanups", () => {
    const cleanup = vi.fn()
    const { unmount } = render(
      <Slot ref={() => cleanup}>
        <div />
      </Slot>
    )
    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it("throws on several children without a Slottable, like Radix", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() =>
      render(
        <Slot>
          <span>a</span>
          <span>b</span>
        </Slot>
      )
    ).toThrow()
  })

  it("composes refs", () => {
    const a = React.createRef<HTMLDivElement>()
    const b = vi.fn()
    render(
      <Slot ref={a}>
        <div ref={b} />
      </Slot>
    )
    expect(a.current).toBeInstanceOf(HTMLDivElement)
    expect(b).toHaveBeenCalledWith(a.current)
  })

  it("lets child props win and passes aria and data attributes", () => {
    render(
      <Slot id="slot" title="slot" aria-label="from slot" data-foo="1">
        <div id="child" data-testid="x" />
      </Slot>
    )
    const el = screen.getByTestId("x")
    expect(el).toHaveAttribute("id", "child")
    expect(el).toHaveAttribute("title", "slot")
    expect(el).toHaveAttribute("aria-label", "from slot")
    expect(el).toHaveAttribute("data-foo", "1")
  })

  it("renders non-element children as is", () => {
    const { container } = render(<Slot>text</Slot>)
    expect(container).toHaveTextContent("text")
  })

  it("Slottable places siblings inside the slotted element", () => {
    render(
      <Slot data-testid="x">
        <b>before</b>
        <Slottable>
          <a href="/y">
            <i>inner</i>
          </a>
        </Slottable>
      </Slot>
    )
    const el = screen.getByTestId("x")
    expect(el.tagName).toBe("A")
    expect(el).toHaveTextContent("beforeinner")
    expect(el.querySelector("a")).toBeNull()
    expect(el.querySelector("b")).not.toBeNull()
  })
})

describe("Button render", () => {
  it("renders one anchor with button classes", () => {
    const { container } = render(<Button render={<a href="/x" className="extra" />}>link</Button>)
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(container.querySelector("button")).toBeNull()
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("data-slot", "button")
    expect(link.className).toContain("inline-flex")
    expect(link.className).toContain("extra")
  })
})

describe("Button asChild", () => {
  it("renders one anchor with button classes", () => {
    const { container } = render(
      <Button asChild>
        <a href="/x">link</a>
      </Button>
    )
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(container.querySelector("button")).toBeNull()
    expect(screen.getByRole("link")).toHaveAttribute("data-slot", "button")
    expect(screen.getByRole("link").className).toContain("inline-flex")
  })
})
