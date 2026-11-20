// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"

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

function RemoveMember(props: { onConfirm?: () => void; onOpenChange?: (open: boolean) => void }) {
  return (
    <AlertDialog onOpenChange={props.onOpenChange}>
      <AlertDialogTrigger>Remove member</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Ana from this client?</AlertDialogTitle>
          <AlertDialogDescription>They lose access right away.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<button type="button" />}>Keep</AlertDialogClose>
          <AlertDialogClose value="confirm" render={<button type="button" />} onClick={props.onConfirm}>
            Remove
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Remove member" }))
  return screen.getByRole("alertdialog", { name: "Remove Ana from this client?" })
}

describe("AlertDialog", () => {
  it("opens from its trigger and is named by its title", () => {
    render(<RemoveMember />)
    const dialog = open()
    expect(dialog).toHaveAttribute("data-slot", "alert-dialog-content")
    expect(dialog).toHaveAttribute("data-open")
    expect(dialog).toHaveTextContent("They lose access right away.")
  })

  it("focuses Cancel first", async () => {
    render(<RemoveMember />)
    open()
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus())
  })

  it("Escape cancels without running the action", () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<RemoveMember onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    const dialog = open()
    fireEvent.keyDown(dialog, { key: "Escape" })
    act(() => {})
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("the confirm close runs the action and closes", () => {
    const onConfirm = vi.fn()
    render(<RemoveMember onConfirm={onConfirm} />)
    open()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    act(() => {})
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
