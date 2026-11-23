// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { Button } from "./button"
import { ButtonGroup } from "./button-group"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

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
})

afterEach(cleanup)

describe("ButtonGroup", () => {
  // A menu opened inside a group renders in place as its child; in a browser ui-sdk marks it popover="manual".
  it("keeps its child rules off a menu popup rendered inside it", () => {
    const { container } = render(
      <ButtonGroup>
        <Button>Owner</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button>Me</Button>} />
          <DropdownMenuContent>
            <DropdownMenuItem>All owners</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    )
    const group = container.querySelector('[data-slot="button-group"]')!
    expect(group.className).toContain("[&>*:not(:first-child,[popover])]:rounded-l-none")
    expect(group.className).toContain("[&>:not([popover]):focus-visible]:relative")
    expect(group.className).not.toMatch(/(^|\s)\*:focus-visible/)
  })
})
