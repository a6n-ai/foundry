// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { Sidebar, SidebarProvider, SidebarTrigger } from "./sidebar"

const sheetLoaded = vi.hoisted(() => vi.fn())

vi.mock("./sheet", async (importOriginal) => {
  sheetLoaded()
  return importOriginal()
})

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
  }
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
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

beforeEach(() => {
  sheetLoaded.mockClear()
})

afterEach(() => {
  cleanup()
  window.innerWidth = 1024
})

function Nav() {
  return (
    <SidebarProvider>
      <SidebarTrigger />
      <Sidebar>
        <p>Nav links</p>
      </Sidebar>
    </SidebarProvider>
  )
}

describe("Sidebar", () => {
  it("does not load the mobile sheet on desktop", async () => {
    render(<Nav />)
    await act(async () => {})
    expect(sheetLoaded).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.querySelector('[data-slot="sidebar"]')).not.toHaveAttribute("data-mobile")
  })

  it("renders the sidebar content in a sheet on mobile once the trigger opens it", async () => {
    window.innerWidth = 500
    render(<Nav />)

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    expect(await screen.findByText("Nav links")).toBeInTheDocument()
    expect(sheetLoaded).toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Sidebar" })).toHaveAttribute("data-mobile", "true")
  })
})
