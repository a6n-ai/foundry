// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { Badge, badgeTone } from "./badge"

afterEach(cleanup)

const tokens = readFileSync(resolve(process.cwd(), "../themes/src/tokens.css"), "utf8")

describe("Badge is one pill with tone variants", () => {
  it("default size is 20px and small is 18px, both on the badge radius token", () => {
    render(
      <>
        <Badge>md</Badge>
        <Badge size="sm">sm</Badge>
      </>
    )
    expect(screen.getByText("md")).toHaveClass("h-5", "rounded-(--ui-radius-badge)", "text-xs", "font-medium")
    expect(screen.getByText("sm")).toHaveClass("h-4.5")
    expect(screen.getByText("sm")).not.toHaveClass("h-5")
  })

  it.each([
    ["neutral", "--muted-foreground"],
    ["info", "--info"],
    ["success", "--success"],
    ["warning", "--warning"],
    ["danger", "--destructive"],
    ["brand", "--primary"],
  ] as const)("the %s tone sets its token and the 14% subtle fill", (tone, token) => {
    render(<Badge variant={tone}>x</Badge>)
    const el = screen.getByText("x")
    expect(el).toHaveClass(`[--ui-badge-tone:var(${token})]`, "bg-[color-mix(in_oklch,var(--ui-badge-tone)_14%,transparent)]")
    expect(badgeTone[tone]).toBe(`[--ui-badge-tone:var(${token})]`)
  })

  it("every existing variant sets a tone token for the admin look", () => {
    for (const variant of ["default", "secondary", "destructive", "outline", "ghost"] as const) {
      render(<Badge variant={variant}>{variant}</Badge>)
      expect(screen.getByText(variant).className).toMatch(/\[--ui-badge-tone:var\(--[a-z-]+\)\]/)
    }
  })

  it("customer :root keeps today's solid default and destructive classes", () => {
    render(
      <>
        <Badge>d</Badge>
        <Badge variant="destructive">e</Badge>
      </>
    )
    expect(screen.getByText("d")).toHaveClass("bg-primary", "text-primary-foreground")
    expect(screen.getByText("e")).toHaveClass("bg-destructive/10", "text-destructive")
  })

  it("the border width comes from the admin token and the legacy border stays for customers", () => {
    render(<Badge>b</Badge>)
    expect(screen.getByText("b")).toHaveClass("border", "border-transparent")
  })

  it("a caller's tone class replaces the variant tone and keeps the caller colour", () => {
    render(<Badge className="[--ui-badge-tone:var(--color-sky-700)]">s</Badge>)
    const el = screen.getByText("s")
    expect(el).toHaveClass("[--ui-badge-tone:var(--color-sky-700)]")
    expect(el).not.toHaveClass("[--ui-badge-tone:var(--primary)]")
  })
})

describe("Badge admin rule in tokens.css", () => {
  const rule = tokens.slice(tokens.indexOf('[data-slot="badge"]'), tokens.indexOf("}", tokens.indexOf('[data-slot="badge"]')))
  const hover = tokens.slice(tokens.indexOf('[data-slot="badge"]:is(a):hover'), tokens.indexOf("}", tokens.indexOf('[data-slot="badge"]:is(a):hover')))
  const reuiSizes = tokens.slice(tokens.indexOf('[data-slot="badge"][data-size]'), tokens.indexOf("}", tokens.indexOf('[data-slot="badge"][data-size]')))

  it("admin pills have no border, the badge radius, the tone fill and tone text", () => {
    expect(rule).toContain("border-width: 0;")
    expect(rule).toContain("border-radius: var(--ui-radius-badge);")
    expect(rule).toContain("background-color: color-mix(in oklch, var(--ui-badge-tone, var(--muted-foreground)) 14%, transparent);")
    expect(rule).toContain("color: var(--ui-badge-tone, var(--muted-foreground));")
  })

  it("text is the tone mixed 55% into the foreground for AA contrast, and the fill falls back to transparent", () => {
    expect(rule).toContain("color: color-mix(in oklch, var(--ui-badge-tone, var(--muted-foreground)) 55%, var(--foreground));")
    expect(rule).toContain("background-color: transparent;")
  })

  it("admin badges never transition colour", () => {
    expect(rule).toContain("transition-property: none;")
  })

  it("linked badges step the fill to 22% on hover, for an anchor badge and for a badge inside a link", () => {
    expect(hover).toContain("22%")
    expect(tokens).toContain('a:hover [data-slot="badge"]')
  })

  it("ReUI badges collapse to a 20px pill with 12px text, and sm to 18px", () => {
    expect(reuiSizes).toContain("height: 1.25rem;")
    expect(reuiSizes).toContain("font-size: 0.75rem;")
    expect(tokens).toContain('[data-slot="badge"][data-size="sm"]')
  })

  it("the link variant stays a plain link in admin", () => {
    expect(rule).toContain('[data-variant="link"]')
  })
})
