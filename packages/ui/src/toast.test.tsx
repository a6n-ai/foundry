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

  it("runs the action onAction when its button is pressed", async () => {
    const onClick = vi.fn()
    render(<Toaster />)
    act(() => {
      toast.success("Installed", { action: { label: "Undo", onAction: onClick } })
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

  it("gives a toast that never times out a Close button, and only that toast", async () => {
    render(<Toaster />)
    act(() => {
      toast("Timed")
      toast.success("Key created", { duration: Infinity })
    })
    const sticky = (await screen.findByText("Key created")).closest<HTMLElement>("[data-slot=toast]")!
    const timed = screen.getByText("Timed").closest<HTMLElement>("[data-slot=toast]")!
    expect(timed.querySelector("[aria-label=Close]")).toBeNull()
    fireEvent.click(sticky.querySelector<HTMLElement>("[aria-label=Close]")!)
    await waitFor(() => expect(screen.queryByText("Key created")).toBeNull())
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

describe("toast stack", () => {
  const show = (...titles: string[]) =>
    act(() => {
      titles.forEach((title) => toast(title, { duration: Infinity }))
    })
  const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-slot=toast]")]

  it("marks only the newest toast as front and numbers the rest by age", async () => {
    render(<Toaster />)
    show("One", "Two", "Three")
    await screen.findByText("Three")
    const byTitle = (t: string) => screen.getByText(t).closest<HTMLElement>("[data-slot=toast]")!
    expect(byTitle("Three")).toHaveAttribute("data-front")
    expect(byTitle("Two")).not.toHaveAttribute("data-front")
    expect(byTitle("One")).not.toHaveAttribute("data-front")
    expect(byTitle("Three").style.getPropertyValue("--toast-index")).toBe("0")
    expect(byTitle("Two").style.getPropertyValue("--toast-index")).toBe("1")
    expect(byTitle("One").style.getPropertyValue("--toast-index")).toBe("2")
  })

  it("queues toasts past maxVisible", async () => {
    render(<Toaster />)
    show("A", "B", "C", "D")
    await screen.findByText("D")
    expect(toasts()).toHaveLength(3)
    expect(screen.queryByText("A")).toBeNull()
  })

  it("lays the stack out from the ui-sdk hooks, for both edges", async () => {
    render(<Toaster />)
    show("Styled")
    const el = (await screen.findByText("Styled")).closest("[data-slot=toast]")!
    const region = document.querySelector("[data-slot=toast-region]")!
    expect(region.className).toContain("data-expanded:h-")
    expect(region.className).toContain("overflow-visible")
    for (const token of ["absolute", "h-(--toast-height)", "origin-bottom", "group-data-[side=top]/region:origin-top", "data-swiping:transition-none", "motion-reduce:"]) {
      expect(el.className).toContain(token)
    }
  })

  it("still runs an action on a stacked toast", async () => {
    const onClick = vi.fn()
    render(<Toaster />)
    act(() => {
      toast("Behind", { duration: Infinity })
      toast("Front", { duration: Infinity, action: { label: "Undo", onAction: onClick } })
    })
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
