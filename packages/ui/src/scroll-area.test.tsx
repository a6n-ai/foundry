// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { ScrollArea, ScrollBar } from "./scroll-area"

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

describe("ScrollArea", () => {
  it("renders children inside the viewport with the data-slot selectors callers use", () => {
    const { container } = render(
      <ScrollArea className="h-20">
        <p>Row one</p>
      </ScrollArea>
    )
    const root = container.querySelector('[data-slot="scroll-area"]')
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    expect(root).toBeInTheDocument()
    expect(root).toHaveClass("h-20")
    expect(viewport).toContainElement(screen.getByText("Row one"))
    expect(root).toContainElement(viewport as HTMLElement)
  })

  it("renders a vertical scrollbar with a thumb by default", () => {
    const { container } = render(<ScrollArea>x</ScrollArea>)
    const bar = container.querySelector('[data-slot="scroll-area-scrollbar"]')
    expect(bar).toHaveAttribute("data-orientation", "vertical")
    expect(bar?.querySelector('[data-slot="scroll-area-thumb"]')).toBeInTheDocument()
  })

  it("keeps the descendant selectors working", () => {
    const { container } = render(
      <ScrollArea className="**:data-[slot=scroll-area-scrollbar]:m-0">x</ScrollArea>
    )
    expect(container.querySelector("[data-slot=scroll-area]")?.className).toContain(
      "scroll-area-scrollbar"
    )
  })

  it("accepts type and scrollHideDelay", () => {
    const { container } = render(
      <ScrollArea type="always" scrollHideDelay={0}>
        x
      </ScrollArea>
    )
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument()
  })

  it("ScrollBar renders a horizontal bar when asked", () => {
    const { container } = render(
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    )
    expect(container.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]')).toBeInTheDocument()
  })
})
