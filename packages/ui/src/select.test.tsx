// @vitest-environment jsdom
import type { ComponentProps } from "react"
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useForm } from "react-hook-form"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./form"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"

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
      textContent: "[popover] { display: block !important }",
    })
  )
})

afterEach(cleanup)

function Roles(props: ComponentProps<typeof Select>) {
  return (
    <Select {...props}>
      <SelectTrigger aria-label="Role">
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="viewer">Viewer</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
      </SelectContent>
    </Select>
  )
}

describe("Select", () => {
  it("names the trigger and shows the placeholder while nothing is selected", () => {
    render(<Roles />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    expect(trigger).toHaveAttribute("data-slot", "select-trigger")
    expect(trigger).toHaveAttribute("data-placeholder")
    expect(trigger).toHaveTextContent("Choose a role")
  })

  it("opens on click, selects an item and closes", () => {
    const onValueChange = vi.fn()
    render(<Roles onValueChange={onValueChange} />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("data-open")
    fireEvent.click(screen.getByRole("option", { name: "Editor" }))
    act(() => {})
    expect(onValueChange.mock.calls[0][0]).toBe("editor")
    expect(trigger).toHaveTextContent("Editor")
    expect(trigger).not.toHaveAttribute("data-open")
  })

  it("closes on Escape and returns focus to the trigger", () => {
    render(<Roles />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    act(() => {})
    expect(trigger).not.toHaveAttribute("data-open")
    expect(trigger).toHaveFocus()
  })

  it("ArrowDown opens the list and highlights the first item", async () => {
    render(<Roles />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const first = await screen.findByRole("option", { name: "Viewer" })
    await waitFor(() => expect(first).toHaveFocus())
    expect(first).toHaveAttribute("data-highlighted")
  })

  it("follows a controlled value", () => {
    const { rerender } = render(<Roles value="viewer" onValueChange={() => {}} />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    expect(trigger).toHaveTextContent("Viewer")
    rerender(<Roles value="editor" onValueChange={() => {}} />)
    expect(trigger).toHaveTextContent("Editor")
  })

  it("shows the placeholder for an empty-string value, as Radix did", () => {
    render(<Roles value="" onValueChange={() => {}} />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    expect(trigger).toHaveAttribute("data-placeholder")
    expect(trigger).toHaveTextContent("Choose a role")
  })

  it("renders the trigger as the element passed to render", () => {
    const { container } = render(
      <Select>
        <SelectTrigger render={<button type="button" className="custom-trigger" />} aria-label="Role">
          <SelectValue placeholder="Choose a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(container.querySelector("button.custom-trigger")).toHaveAttribute("data-slot", "select-trigger")
  })

  it("renders the list in place, not in a portal", () => {
    const { container } = render(<Roles />)
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }))
    expect(container).toContainElement(screen.getByRole("listbox"))
  })

  it("keeps a click on an item away from the row or card around it", () => {
    const onRowClick = vi.fn()
    render(
      <div role="presentation" onClick={onRowClick}>
        <Roles />
      </div>
    )
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }))
    onRowClick.mockClear()
    fireEvent.click(screen.getByRole("option", { name: "Viewer" }))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("groups items under a group label and separates them", async () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Dish">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectGroupLabel>Mains</SelectGroupLabel>
            <SelectItem value="a">Dal</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="b">Rice</SelectItem>
        </SelectContent>
      </Select>
    )
    fireEvent.click(screen.getByRole("combobox", { name: "Dish" }))
    expect(await screen.findByRole("group", { name: "Mains" })).toHaveClass("scroll-my-1", "p-1")
  })

  it("keeps the list closed when an option is picked inside a label", () => {
    const onValueChange = vi.fn()
    render(
      <label>
        <Roles onValueChange={onValueChange} />
      </label>
    )
    const trigger = screen.getByRole("combobox", { name: "Role" })
    fireEvent.click(trigger)
    const notForwarded = fireEvent.click(screen.getByRole("option", { name: "Editor" }))
    act(() => {})
    expect(notForwarded).toBe(false)
    expect(onValueChange.mock.calls[0][0]).toBe("editor")
    expect(trigger).toHaveTextContent("Editor")
    expect(trigger).not.toHaveAttribute("data-open")
  })

  it("styles the content and items with theme tokens and state attributes only", () => {
    render(<Roles />)
    const trigger = screen.getByRole("combobox", { name: "Role" })
    fireEvent.click(trigger)
    const list = screen.getByRole("listbox")
    expect(list).toHaveAttribute("data-open")
    expect(list.className).not.toMatch(/radix|rgb\(|#[0-9a-f]{3,8}\b|transition-all/i)
    expect(list).toHaveClass(
      "rounded-(--ui-radius-popup)",
      "p-(--ui-select-padding)",
      "min-w-[max(9rem,var(--anchor-width))]",
      "shadow-(--ui-shadow-popup)",
      "bg-popover",
      "max-h-(--available-height)",
      "duration-150",
      "ease-soft",
      "motion-reduce:transition-none"
    )
    expect(list).not.toHaveClass("min-w-36")
    const item = screen.getByRole("option", { name: "Viewer" })
    expect(item).toHaveClass(
      "h-(--ui-select-item-height)",
      "text-(length:--ui-select-item-size)",
      "leading-5",
      "data-highlighted:bg-(--ui-select-highlight)",
      "data-highlighted:text-(color:--ui-select-highlight-fg)"
    )
    expect(trigger).toHaveClass("rounded-(--ui-radius-control)", "focus-visible:ring-(length:--ui-focus-ring)")
    expect(trigger.className).not.toMatch(/radix|transition-all/)
    expect(document.body.innerHTML).not.toContain("data-state")
  })

  it("sizes the small trigger with the size prop", () => {
    render(
      <Select>
        <SelectTrigger size="sm" aria-label="Role">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveAttribute("data-size", "sm")
  })
})

describe("Select in a react-hook-form form", () => {
  type Values = { role: string | null }

  function FormHarness({
    defaultValue,
    onSubmit,
  }: {
    defaultValue: string | null
    onSubmit: (values: Values) => void
  }) {
    const form = useForm<Values>({ defaultValues: { role: defaultValue } })
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="role"
            rules={{ required: "Pick a role" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => form.reset()}>
            Reset
          </button>
        </form>
      </Form>
    )
  }

  it("labels the trigger with its FormLabel", () => {
    render(<FormHarness defaultValue="viewer" onSubmit={() => {}} />)
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("Viewer")
  })

  it("submits the chosen value", async () => {
    const onSubmit = vi.fn()
    render(<FormHarness defaultValue="viewer" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }))
    fireEvent.click(screen.getByRole("option", { name: "Editor" }))
    act(() => {})
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toEqual({ role: "editor" })
  })

  it("blocks submit with the rule message while nothing is selected", async () => {
    const onSubmit = vi.fn()
    render(<FormHarness defaultValue={null} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Pick a role")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveAttribute("aria-invalid", "true")
  })

  it("returns to the default value on reset", async () => {
    const onSubmit = vi.fn()
    render(<FormHarness defaultValue="viewer" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }))
    fireEvent.click(screen.getByRole("option", { name: "Editor" }))
    act(() => {})
    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("Viewer")
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toEqual({ role: "viewer" })
  })

  it("submits the value under its name in native form data", () => {
    let data: FormData | undefined
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          data = new FormData(event.currentTarget)
        }}
      >
        <Select name="role" defaultValue="editor">
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
          </SelectContent>
        </Select>
        <button type="submit">Save</button>
      </form>
    )
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(data?.get("role")).toBe("editor")
  })

  it("blocks a native submit of a required select with nothing selected", () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <form onSubmit={onSubmit}>
        <Select name="role" required>
          <SelectTrigger aria-label="Role">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <button type="submit">Save</button>
      </form>
    )
    container.querySelector("form")!.requestSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
