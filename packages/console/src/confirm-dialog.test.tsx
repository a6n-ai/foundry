// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { ConfirmDialog, confirmReady, typedHint, typedMatches } from "./confirm-dialog"

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
  document.head.append(Object.assign(document.createElement("style"), { textContent: "[popover][data-open] { display: block !important }" }))
})

afterEach(cleanup)

const open = () => fireEvent.click(screen.getByRole("button", { name: "Remove member" }))

describe("ConfirmDialog", () => {
  it("typed gates the confirm button", () => {
    render(<ConfirmDialog trigger="Remove member" title="Remove?" confirmLabel="Remove" typed="Remove" onConfirm={async () => {}} />)
    open()
    const confirm = screen.getByRole("button", { name: "Remove" })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Remove" } })
    expect(confirm).toBeEnabled()
  })

  it("a rejection shows the error and keeps the dialog open", async () => {
    render(
      <ConfirmDialog
        trigger="Remove member"
        title="Remove?"
        confirmLabel="Remove"
        onConfirm={async () => {
          throw new Error("last_admin")
        }}
      />,
    )
    open()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(await screen.findByText("last_admin")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument())
  })

  it("helpers", () => {
    expect(typedMatches(undefined, "")).toBe(true)
    expect(typedMatches("Remove", "remove")).toBe(false)
    expect(confirmReady("Remove", "Remove", true)).toBe(false)
    expect(typedHint("Remove", "remove")).toBeDefined()
    expect(typedHint("Remove", "Rem")).toBeUndefined()
  })
})
