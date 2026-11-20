// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ResponsiveDialog } from "./responsive-dialog";

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
