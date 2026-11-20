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
})

describe("Badge admin rule in tokens.css", () => {
  const rule = tokens.slice(tokens.indexOf('[data-slot="badge"]'), tokens.indexOf("}", tokens.indexOf('[data-slot="badge"]')))

  it("admin pills have no border, the badge radius, the tone fill and tone text", () => {
    expect(rule).toContain("border-width: 0;")
    expect(rule).toContain("border-radius: var(--ui-radius-badge);")
    expect(rule).toContain("background-color: color-mix(in oklch, var(--ui-badge-tone, var(--muted-foreground)) 14%, transparent);")
    expect(rule).toContain("color: var(--ui-badge-tone, var(--muted-foreground));")
  })

  it("the link variant stays a plain link in admin", () => {
    expect(rule).toContain('[data-variant="link"]')
  })
})
