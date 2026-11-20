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

  it("defaults to the control radius and the animated shimmer", () => {
    expect(skeleton()).toHaveClass("rounded-(--ui-radius-control)", "animate-pulse", "skeleton-shimmer", "bg-muted")
  })

  it("maps shape to radius", () => {
    expect(skeleton({ shape: "pill" })).toHaveClass("rounded-full")
    expect(skeleton({ shape: "squared" })).toHaveClass("rounded-none")
    expect(skeleton({ shape: "squared" })).not.toHaveClass("rounded-(--ui-radius-control)")
  })

  it("drops the animation classes when animated is false", () => {
    const el = skeleton({ animated: false })
    expect(el).not.toHaveClass("animate-pulse", "skeleton-shimmer")
    expect(el).toHaveClass("bg-muted")
  })

  it("keeps caller classes", () => {
    expect(skeleton({ className: "h-9 w-48" })).toHaveClass("h-9", "w-48")
  })

  it("admin shimmer is scoped out of :root and off under reduced motion", () => {
    expect(tokens).toMatch(/@keyframes skeleton-shimmer\s*{/)
    expect(tokens).toMatch(/\.crm-app:not\(\.customer-app\) \.skeleton-shimmer\s*{[^}]*animation:/)
    expect(tokens).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.skeleton-shimmer/)
    expect(tokens).not.toMatch(/:root\s*{[^}]*skeleton/)
  })
})
