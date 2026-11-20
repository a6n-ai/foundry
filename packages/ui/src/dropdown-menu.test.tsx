// @vitest-environment jsdom
import * as React from "react"
import type { ComponentProps } from "react"
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Button } from "./button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Menu,
  MenuItem,
} from "./dropdown-menu"

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

function Actions(props: ComponentProps<typeof DropdownMenu>) {
  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Member</DropdownMenuLabel>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>
            Duplicate
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function open(trigger: HTMLElement) {
  fireEvent.click(trigger)
  return screen.findByRole("menu")
}

describe("DropdownMenu", () => {
  it("opens on click and names its items", async () => {
    render(<Actions />)
    const trigger = screen.getByRole("button", { name: "Actions" })
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    await open(trigger)
    expect(trigger).toHaveAttribute("data-open")
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-destructive")
  })

  it("renders the list in place, not in a portal", async () => {
    const { container } = render(<Actions />)
    await open(screen.getByRole("button", { name: "Actions" }))
    expect(container).toContainElement(screen.getByRole("menu"))
  })

  it("moves focus through items with the arrow keys", async () => {
    render(<Actions />)
    const trigger = screen.getByRole("button", { name: "Actions" })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const rename = await screen.findByRole("menuitem", { name: "Rename" })
    await waitFor(() => expect(rename).toHaveFocus())
    fireEvent.keyDown(rename, { key: "ArrowDown" })
    const duplicate = screen.getByRole("menuitem", { name: /Duplicate/ })
    await waitFor(() => expect(duplicate).toHaveFocus())
    expect(duplicate).toHaveAttribute("data-highlighted")
  })

  it("runs an item with Enter, closes and returns focus to the trigger", async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const rename = await screen.findByRole("menuitem", { name: "Rename" })
    await waitFor(() => expect(rename).toHaveFocus())
    fireEvent.keyDown(rename, { key: "Enter" })
    await waitFor(() => expect(trigger).not.toHaveAttribute("data-open"))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveFocus()
  })

  it("runs an item with a click and closes the menu", async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    await open(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
    await waitFor(() => expect(trigger).not.toHaveAttribute("data-open"))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("runs an item's onClick and closes the menu", async () => {
    const onClick = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onClick}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    await open(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
    await waitFor(() => expect(trigger).not.toHaveAttribute("data-open"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Actions />)
    const trigger = screen.getByRole("button", { name: "Actions" })
    await open(trigger)
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
    await waitFor(() => expect(trigger).not.toHaveAttribute("data-open"))
    expect(trigger).toHaveFocus()
  })

  it("keeps the menu open for a checkbox item and reports the change", async () => {
    const onCheckedChange = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem value="wrap" checked={false} onCheckedChange={onCheckedChange}>
            Word wrap
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "View" })
    await open(trigger)
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Word wrap" }))
    await act(async () => {})
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("keeps the menu open for a radio item and selects one value", async () => {
    const onValueChange = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Density</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup defaultValue="compact" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await open(screen.getByRole("button", { name: "Density" }))
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Comfortable" }))
    await act(async () => {})
    expect(onValueChange).toHaveBeenCalledWith("comfortable", expect.anything())
    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(screen.getByRole("menuitemradio", { name: "Comfortable" })).toHaveAttribute("aria-checked", "true")
  })

  it("opens a submenu with ArrowRight and runs its item", async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Transform</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={onSelect}>Uppercase</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "Edit" })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const transform = await screen.findByRole("menuitem", { name: "Transform" })
    await waitFor(() => expect(transform).toHaveFocus())
    fireEvent.keyDown(transform, { key: "ArrowRight" })
    const uppercase = await screen.findByRole("menuitem", { name: "Uppercase" })
    await waitFor(() => expect(uppercase).toHaveFocus())
    fireEvent.keyDown(uppercase, { key: "Enter" })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("renders the trigger as the element passed to render", () => {
    const { container } = render(
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="custom-trigger" />}>
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(container.querySelector("button.custom-trigger")).toHaveTextContent("Actions")
  })

  it("keeps a click on an item away from the row or card around it", async () => {
    const onRowClick = vi.fn()
    render(
      <div role="presentation" onClick={onRowClick}>
        <Actions />
      </div>
    )
    await open(screen.getByRole("button", { name: "Actions" }))
    onRowClick.mockClear()
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("exports the ui-sdk names beside the wrappers", () => {
    expect(Menu).toBe(DropdownMenu)
    expect(MenuItem).toBeDefined()
  })

  it("returns focus to the menu trigger when a dialog opened from an item closes", async () => {
    function DialogFromItem() {
      const [dialogOpen, setDialogOpen] = React.useState(false)
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setDialogOpen(true)}>Add discount…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogTitle>Add discount</DialogTitle>
              <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
            </DialogContent>
          </Dialog>
        </>
      )
    }
    render(<DialogFromItem />)
    const trigger = screen.getByRole("button", { name: "Actions" })
    await open(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: "Add discount…" }))
    const dialog = await screen.findByRole("dialog", { name: "Add discount" })
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
