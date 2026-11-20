// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "./card"

afterEach(cleanup)

const tokens = readFileSync(resolve(process.cwd(), "../themes/src/tokens.css"), "utf8")
const block = (selector: string) => {
  const start = tokens.indexOf(`\n${selector} {`)
  return tokens.slice(start, tokens.indexOf("\n}", start))
}
const rootBlock = block(":root")
const adminBlock = block(".crm-app:not(.customer-app), body:has(.crm-app:not(.customer-app))")

describe("Card reads the --ui-* tokens", () => {
  it("the card shell uses the card radius token and the hairline ring token, with no shadow", () => {
    render(<Card>body</Card>)
    const card = screen.getByText("body")
    expect(card).toHaveClass(
      "rounded-(--ui-radius-card)",
      "ring-[color:var(--ui-card-ring,color-mix(in_oklab,var(--foreground)_10%,transparent))]"
    )
    expect(card.className).not.toMatch(/rounded-xl\b|ring-foreground\/10|shadow/)
  })

  it("the title reads the title size and weight tokens", () => {
    render(<CardTitle>Orders</CardTitle>)
    const title = screen.getByText("Orders")
    expect(title).toHaveClass("text-(length:--ui-card-title-size)", "font-(weight:--ui-card-title-weight)")
    expect(title.className).not.toMatch(/text-base\b|font-medium\b/)
  })

  it("the description reads the description size token", () => {
    render(<CardDescription>Last 7 days</CardDescription>)
    const desc = screen.getByText("Last 7 days")
    expect(desc).toHaveClass("text-(length:--ui-card-description-size)", "text-muted-foreground")
    expect(desc.className).not.toMatch(/text-sm\b/)
  })

  it("the action slot stays right-aligned and the body keeps the 16px padding", () => {
    render(
      <Card>
        <CardAction>act</CardAction>
        <CardContent>content</CardContent>
      </Card>
    )
    expect(screen.getByText("act")).toHaveClass("justify-self-end")
    expect(screen.getByText("content")).toHaveClass("px-(--card-spacing)")
    expect(screen.getByText("content").parentElement).toHaveClass("[--card-spacing:--spacing(4)]")
  })
})

describe("CardHeader divided", () => {
  it("draws a hairline under the header and keeps the card padding under it", () => {
    render(<CardHeader divided>head</CardHeader>)
    expect(screen.getByText("head")).toHaveClass("border-b", "border-border", "pb-(--card-spacing)")
  })

  it("draws no divider by default", () => {
    render(<CardHeader>plain</CardHeader>)
    expect(screen.getByText("plain")).not.toHaveClass("border-b")
  })
})

describe("Card token values", () => {
  it("customer :root keeps today's card, title, description and ring values", () => {
    expect(rootBlock).toContain("--ui-card-title-size: 1rem;")
    expect(rootBlock).toContain("--ui-card-title-weight: 500;")
    expect(rootBlock).toContain("--ui-card-description-size: 0.875rem;")
    expect(rootBlock).not.toContain("--ui-card-ring")
    expect(rootBlock).toContain("--ui-radius-card: var(--radius-xl);")
  })

  it("admin takes the Geist card values", () => {
    expect(adminBlock).toContain("--ui-card-title-size: 0.875rem;")
    expect(adminBlock).toContain("--ui-card-title-weight: 500;")
    expect(adminBlock).toContain("--ui-card-description-size: 0.8125rem;")
    expect(adminBlock).toContain("--ui-card-ring: var(--border);")
    expect(adminBlock).toContain("--ui-radius-card: 10px;")
  })
})
