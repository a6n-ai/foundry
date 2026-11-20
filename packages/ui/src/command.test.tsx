// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { Command, CommandDialog, CommandInput } from "./command"

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover][data-open] { display: block !important }",
    })
  )
})

afterEach(cleanup)

describe("CommandDialog", () => {
  it("names the dialog by its title", () => {
    render(
      <CommandDialog open title="Find a page" description="Jump anywhere">
        <Command>
          <CommandInput />
        </Command>
      </CommandDialog>
    )
    expect(screen.getByRole("dialog", { name: "Find a page" })).toBeInTheDocument()
  })
})
