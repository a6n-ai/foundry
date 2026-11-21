// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Toaster, toast } from "./toast"

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  document.head.append(
    Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" })
  )
})

afterEach(() => {
  act(() => {
    toast.dismiss()
  })
  cleanup()
})

describe("toast facade", () => {
  it("renders success and error toasts through the Toaster with their type", async () => {
    render(<Toaster />)
    act(() => {
      toast.success("Saved", { description: "All changes stored" })
      toast.error("Could not save")
    })
    const saved = (await screen.findByText("Saved")).closest("[data-slot=toast]")
    expect(saved).toHaveAttribute("data-type", "success")
    expect(screen.getByText("All changes stored")).toBeInTheDocument()
    expect(screen.getByText("Could not save").closest("[data-slot=toast]")).toHaveAttribute("data-type", "error")
  })

  it("renders plain, info and warning toasts", async () => {
    render(<Toaster />)
    act(() => {
      toast("Plain")
      toast.info("Heads up")
      toast.warning("Careful")
    })
    expect((await screen.findByText("Plain")).closest("[data-slot=toast]")).toHaveAttribute("data-type", "default")
    expect(screen.getByText("Heads up").closest("[data-slot=toast]")).toHaveAttribute("data-type", "info")
    expect(screen.getByText("Careful").closest("[data-slot=toast]")).toHaveAttribute("data-type", "warning")
  })

  it("runs the sonner-shaped action onClick when its button is pressed", async () => {
    const onClick = vi.fn()
    render(<Toaster />)
    act(() => {
      toast.success("Installed", { action: { label: "Undo", onClick } })
    })
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("shows loading, then the success text, for a promise", async () => {
    render(<Toaster />)
    let resolve!: () => void
    const pending = new Promise<void>((r) => (resolve = r))
    act(() => {
      toast.promise(pending, { loading: "Saving", success: "Saved", error: "Failed" })
    })
    expect(await screen.findByText("Saving")).toBeInTheDocument()
    await act(async () => resolve())
    expect(await screen.findByText("Saved")).toBeInTheDocument()
  })

  it("dismisses a toast by the id it returned, and reuses an id", async () => {
    render(<Toaster />)
    let id = ""
    act(() => {
      id = toast("First", { id: "same" }) as string
      toast("Second", { id: "same" })
    })
    expect(id).toBe("same")
    expect(await screen.findByText("Second")).toBeInTheDocument()
    expect(screen.queryByText("First")).toBeNull()
    act(() => {
      toast.dismiss(id)
    })
    await waitFor(() => expect(screen.queryByText("Second")).toBeNull())
  })

  it("keeps a toast with an infinite duration", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Toaster />)
    act(() => {
      toast.error("Sticky", { duration: Infinity })
    })
    expect((await screen.findAllByText("Sticky")).length).toBeGreaterThan(0)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(document.querySelector("[data-slot=toast-title]")).toHaveTextContent("Sticky")
    vi.useRealTimers()
  })

  it("places the region from a sonner position", () => {
    render(<Toaster position="top-right" />)
    act(() => {
      toast("Placed")
    })
    const region = document.querySelector("[data-slot=toast-region]")
    expect(region).toHaveAttribute("data-side", "top")
    expect(region).toHaveAttribute("data-align", "end")
  })
})
