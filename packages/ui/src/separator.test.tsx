// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Separator } from "./separator"

afterEach(cleanup)

describe("Separator", () => {
  it("is decorative by default", () => {
    const { container } = render(<Separator />)
    const el = container.firstElementChild!
    expect(el).toHaveAttribute("role", "none")
    expect(el).toHaveAttribute("data-slot", "separator")
    expect(el).toHaveAttribute("data-orientation", "horizontal")
    expect(screen.queryByRole("separator")).toBeNull()
  })

  it("is a semantic separator when not decorative", () => {
    render(<Separator decorative={false} orientation="vertical" />)
    const el = screen.getByRole("separator")
    expect(el).toHaveAttribute("aria-orientation", "vertical")
    expect(el).toHaveAttribute("data-orientation", "vertical")
  })

  it("sizes by orientation and keeps className and data attrs", () => {
    render(<Separator decorative={false} className="my-3" data-testid="s" />)
    const el = screen.getByTestId("s")
    expect(el).toHaveClass("my-3", "bg-border", "data-[orientation=horizontal]:h-px")
  })
})
