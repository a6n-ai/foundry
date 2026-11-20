// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Skeleton } from "./skeleton"

afterEach(cleanup)

const tokens = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../themes/src/tokens.css"), "utf8")

function skeleton(props: Parameters<typeof Skeleton>[0] = {}) {
  const { container } = render(<Skeleton {...props} />)
  return container.querySelector('[data-slot="skeleton"]')!
}

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    expect(skeleton()).toHaveAttribute("aria-hidden", "true")
  })

  it("defaults to the skeleton radius and the animated shimmer", () => {
    expect(skeleton()).toHaveClass("rounded-(--ui-radius-skeleton)", "animate-pulse", "skeleton-shimmer", "bg-muted")
  })

  it("maps shape to radius", () => {
    expect(skeleton({ shape: "pill" })).toHaveClass("rounded-full")
    expect(skeleton({ shape: "squared" })).toHaveClass("rounded-none")
    expect(skeleton({ shape: "squared" })).not.toHaveClass("rounded-(--ui-radius-skeleton)")
  })

  it("drops the animation classes when animated is false", () => {
    const el = skeleton({ animated: false })
    expect(el).not.toHaveClass("animate-pulse", "skeleton-shimmer")
    expect(el).toHaveClass("bg-muted")
  })

  it("keeps caller classes", () => {
    expect(skeleton({ className: "h-9 w-48" })).toHaveClass("h-9", "w-48")
  })

  it("admin shimmer is scoped out of :root, reaches portals, and is off under reduced motion", () => {
    expect(tokens).toMatch(/@keyframes skeleton-shimmer\s*{/)
    expect(tokens).toMatch(/\.admin-ui \.skeleton-shimmer, body:has\(\.admin-ui\) \.skeleton-shimmer\s*{[^}]*animation:/)
    expect(tokens).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*body:has\(\.admin-ui\) \.skeleton-shimmer/)
    expect(tokens).not.toMatch(/:root\s*{[^}]*skeleton-shimmer/)
  })

  it("keeps the customer skeleton corner and takes the admin 6px", () => {
    expect(tokens).toMatch(/:root\s*{[^}]*--ui-radius-skeleton: var\(--radius-md\);/)
    expect(tokens).toMatch(/\.admin-ui, body:has\(\.admin-ui\)\s*{[^}]*--ui-radius-skeleton: 6px;/)
  })
})
