// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Badge } from "./badge"
import { Button } from "./button"
import { Input } from "./input"
import { Select, SelectTrigger, SelectValue } from "./select"
import { Textarea } from "./textarea"

afterEach(cleanup)

describe("Vercel-look primitives read the --ui-* tokens", () => {
  it("Button reads the control tokens and never transition-all", () => {
    render(<Button>Save</Button>)
    const b = screen.getByRole("button")
    expect(b).toHaveClass(
      "rounded-(--ui-radius-control)",
      "transition-colors",
      "active:not-aria-[haspopup]:translate-y-(--ui-press-shift)"
    )
    expect(b.className).not.toMatch(/transition-all|rounded-lg\b/)
  })

  it("Button primary hover uses the token", () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole("button")).toHaveClass("hover:bg-(--ui-primary-hover)")
  })

  it("Button sm and xs use their radius tokens", () => {
    render(
      <>
        <Button size="sm">a</Button>
        <Button size="xs">b</Button>
      </>
    )
    expect(screen.getByText("a")).toHaveClass("rounded-(--ui-radius-control-sm)")
    expect(screen.getByText("b")).toHaveClass("rounded-(--ui-radius-control-xs)")
  })

  it("a caller rounded class wins over the token radius", () => {
    render(<Button className="rounded-full">x</Button>)
    const b = screen.getByRole("button")
    expect(b).toHaveClass("rounded-full")
    expect(b).not.toHaveClass("rounded-(--ui-radius-control)")
  })

  it("Input and Textarea use the control radius and focus token", () => {
    render(
      <>
        <Input aria-label="i" />
        <Textarea aria-label="t" />
      </>
    )
    for (const el of [screen.getByLabelText("i"), screen.getByLabelText("t")]) {
      expect(el).toHaveClass("rounded-(--ui-radius-control)", "focus-visible:ring-(length:--ui-focus-ring)")
      expect(el.className).not.toMatch(/rounded-lg\b|ring-3\b/)
    }
  })

  it("SelectTrigger uses the control radius and focus token", () => {
    render(
      <Select>
        <SelectTrigger aria-label="s">
          <SelectValue placeholder="p" />
        </SelectTrigger>
      </Select>
    )
    const t = document.querySelector('[data-slot="select-trigger"]')!
    expect(t).toHaveClass("rounded-(--ui-radius-control)", "focus-visible:ring-(length:--ui-focus-ring)")
    expect(t.className).not.toMatch(/rounded-lg\b|ring-3\b/)
  })

  it("Badge uses the badge radius and no transition-all", () => {
    render(<Badge>Active</Badge>)
    const el = screen.getByText("Active")
    expect(el).toHaveClass("rounded-(--ui-radius-badge)")
    expect(el.className).not.toMatch(/transition-all|rounded-4xl/)
  })
})
