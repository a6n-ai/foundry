// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState, type ComponentProps } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

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

function Project(props: ComponentProps<typeof Dialog>) {
  return (
    <Dialog {...props}>
      <DialogTrigger>Open project</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project details</DialogTitle>
          <DialogDescription>Review the details before continuing.</DialogDescription>
        </DialogHeader>
        <Select defaultValue="viewer">
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <DialogClose>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  it("opens from its trigger and names the dialog by its title", () => {
    render(<Project />)
    const trigger = screen.getByRole("button", { name: "Open project" })
    expect(trigger).toHaveAttribute("data-slot", "dialog-trigger")
    fireEvent.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "Project details" })
    expect(dialog).toHaveAttribute("data-slot", "dialog-content")
    expect(dialog).toHaveAttribute("data-open")
    expect(dialog).toHaveTextContent("Review the details before continuing.")
  })

  it("moves focus into the dialog", async () => {
    render(<Project />)
    fireEvent.click(screen.getByRole("button", { name: "Open project" }))
    const dialog = screen.getByRole("dialog", { name: "Project details" })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Project />)
    const trigger = screen.getByRole("button", { name: "Open project" })
    fireEvent.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "Project details" })
    fireEvent.keyDown(dialog, { key: "Escape" })
    act(() => {})
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes on the Done button", () => {
    render(<Project />)
    fireEvent.click(screen.getByRole("button", { name: "Open project" }))
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    act(() => {})
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("nested Select: Escape closes only the select", () => {
    render(<Project />)
    fireEvent.click(screen.getByRole("button", { name: "Open project" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }))
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    act(() => {})
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Project details" })).toHaveAttribute("data-open")
  })

  it("follows a controlled open state", () => {
    const onOpenChange = vi.fn()
    function Controlled() {
      const [open, setOpen] = useState(false)
      return (
        <Dialog open={open} onOpenChange={(next: boolean) => { onOpenChange(next); setOpen(next) }}>
          <DialogTrigger>Open project</DialogTrigger>
          <DialogContent>
            <DialogTitle>Project details</DialogTitle>
            <DialogClose>Done</DialogClose>
          </DialogContent>
        </Dialog>
      )
    }
    render(<Controlled />)
    fireEvent.click(screen.getByRole("button", { name: "Open project" }))
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole("dialog", { name: "Project details" })).toHaveAttribute("data-open")
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    act(() => {})
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it("renders the trigger as the element passed to render", () => {
    render(
      <Dialog>
        <DialogTrigger render={<a href="/changelog" />}>Changelog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Changelog</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByRole("link", { name: "Changelog" })).toHaveAttribute("data-slot", "dialog-trigger")
  })

  it("keeps the label of an element passed to render", () => {
    render(
      <Dialog>
        <DialogTrigger render={<button type="button">Edit role</button>} />
        <DialogContent>
          <DialogTitle>Edit role</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByRole("button", { name: "Edit role" })).toHaveAttribute("data-slot", "dialog-trigger")
  })

  it("styles the content with theme tokens and state attributes only", () => {
    render(<Project />)
    fireEvent.click(screen.getByRole("button", { name: "Open project" }))
    const content = screen.getByRole("dialog", { name: "Project details" })
    expect(content.className).not.toMatch(/rgb\(|#[0-9a-f]{3,8}\b|transition-all/i)
    expect(content).toHaveClass(
      "rounded-(--ui-radius-modal)",
      "shadow-(--ui-shadow-modal)",
      "bg-popover",
      "motion-reduce:transition-none",
      "data-starting-style:opacity-0",
      "data-ending-style:opacity-0"
    )
    expect(content.outerHTML).not.toContain("data-state")
  })
})
