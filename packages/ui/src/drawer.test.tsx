// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer"

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

function Sheet(props: Partial<React.ComponentProps<typeof Drawer>>) {
  return (
    <Drawer {...props}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Create</DrawerTitle>
          <DrawerDescription>Pick one</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose>Done</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

describe("Drawer", () => {
  it("opens from its trigger, is named by its title, and closes from DrawerClose", () => {
    render(<Sheet />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("dialog", { name: "Create" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes on Escape", () => {
    render(<Sheet />)
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it.each(["top", "bottom", "left", "right"] as const)("direction=%s sets data-side on the content", (direction) => {
    render(<Sheet open direction={direction} />)
    const content = document.querySelector('[data-slot="drawer-content"]')
    expect(content).toHaveAttribute("data-side", direction)
  })

  it("defaults to the bottom", () => {
    render(<Sheet open />)
    expect(document.querySelector('[data-slot="drawer-content"]')).toHaveAttribute("data-side", "bottom")
  })

  it("round-trips controlled open/onOpenChange", () => {
    const seen: boolean[] = []
    function Controlled() {
      const [open, setOpen] = useState(false)
      return (
        <Sheet
          open={open}
          onOpenChange={(o) => {
            seen.push(o)
            setOpen(o)
          }}
        />
      )
    }
    render(<Controlled />)
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(seen).toEqual([true, false])
  })

  it("replaces the trigger element through asChild", () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <a href="#x">Go</a>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>T</DrawerTitle>
        </DrawerContent>
      </Drawer>
    )
    const link = screen.getByText("Go")
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("data-slot", "drawer-trigger")
    fireEvent.click(link)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("draws a grip on the open edge and uses side attributes, never vaul or data-state", () => {
    render(<Sheet open direction="top" />)
    const content = document.querySelector('[data-slot="drawer-content"]') as HTMLElement
    expect(content.className).not.toMatch(/vaul|data-\[state|transition-all/)
    expect(document.querySelector("[data-vaul-drawer],[vaul-drawer]")).toBeNull()
    expect(content.querySelector('[data-slot="drawer-grip"]')).not.toBeNull()
  })

  it("keeps accepting the retired vaul props without passing them on", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<Sheet open nested handleOnly shouldScaleBackground />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
