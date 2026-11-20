// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@foundry/ui/use-mobile", () => ({ useIsMobile: () => false }));

import { ResponsiveDialog } from "./responsive-dialog";

// jsdom lacks the top-layer APIs ui-sdk dialogs call.
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


// A row action opens the dialog by state, with no Trigger, like RowActionButton callers do.
function RowAction() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Remove</button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this?"
        footer={<button type="button" onClick={() => setOpen(false)}>Cancel</button>}
      >
        {null}
      </ResponsiveDialog>
    </>
  );
}

const nextFrame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

describe("ResponsiveDialog focus return", () => {
  it("puts focus back on the button that opened a trigger-less dialog", async () => {
    render(<RowAction />);
    const opener = screen.getByRole("button", { name: "Remove" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await nextFrame();
    expect(document.activeElement).toBe(opener);
  });
});

describe("ResponsiveDialog desktop title", () => {
  it("takes its size and weight from the modal tokens", () => {
    render(
      <ResponsiveDialog open title="Edit member" onOpenChange={() => {}}>
        <p>Body</p>
      </ResponsiveDialog>
    )
    const title = screen.getByText("Edit member")
    expect(title).toHaveClass("text-(length:--ui-modal-heading-size)", "font-(weight:--ui-modal-title-weight)")
    expect(title).not.toHaveClass("text-lg", "font-semibold")
  })
})
