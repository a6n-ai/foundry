// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "./alert-dialog"
import { Dialog, DialogContent, DialogTrigger } from "./dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Sheet, SheetTrigger } from "./sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

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

function expectOnlyChildButton(name: string) {
  expect(document.querySelectorAll("button")).toHaveLength(1)
  expect(screen.getByRole("button", { name })).toBeInTheDocument()
  expect(document.body.innerHTML).not.toContain("aschild")
}

describe("asChild back-compat", () => {
  it("TooltipProvider renders its children without needing a provider in the tree", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <p>inside</p>
      </TooltipProvider>
    )
    expect(screen.getByText("inside")).toBeInTheDocument()
  })

  it("TooltipTrigger asChild renders the child as the only button", () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button>Save</button>
        </TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
    )
    expectOnlyChildButton("Save")
  })

  it("TooltipTrigger still takes the ui-sdk render prop", () => {
    render(
      <Tooltip>
        <TooltipTrigger render={<button type="button" />}>Copy</TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
    )
    expectOnlyChildButton("Copy")
  })

  it("PopoverTrigger asChild renders the child as the only button", () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <button>Filter</button>
        </PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    )
    expectOnlyChildButton("Filter")
  })

  it("DialogTrigger asChild renders the child as the only button", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button>Create</button>
        </DialogTrigger>
        <DialogContent>Body</DialogContent>
      </Dialog>
    )
    expectOnlyChildButton("Create")
  })

  it("AlertDialogTrigger asChild renders the child as the only button", () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button>Remove</button>
        </AlertDialogTrigger>
        <AlertDialogContent>Body</AlertDialogContent>
      </AlertDialog>
    )
    expectOnlyChildButton("Remove")
  })

  it("SheetTrigger asChild renders the child as the only button", () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button>Details</button>
        </SheetTrigger>
      </Sheet>
    )
    expectOnlyChildButton("Details")
  })

  it("DropdownMenuTrigger asChild renders the child as the only button", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expectOnlyChildButton("Actions")
  })

  it("DropdownMenuItem asChild renders the child link as the only menu item", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <a href="/rename">Rename</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    fireEvent.click(screen.getByRole("button", { name: "Actions" }))
    await screen.findByRole("menu")
    const items = screen.getAllByRole("menuitem")
    expect(items).toHaveLength(1)
    expect(items[0].tagName).toBe("A")
    expect(items[0]).toHaveAttribute("href", "/rename")
    expect(document.body.innerHTML).not.toContain("aschild")
  })
})
