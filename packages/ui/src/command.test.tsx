// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command"

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

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })

// ui-sdk listens for the native input event.
const type = (value: string) => fireEvent.input(screen.getByRole("combobox"), { target: { value } })

function Fruit({ onSelect = () => {}, ...root }: { onSelect?: (value: string) => void } & React.ComponentProps<typeof Command>) {
  return (
    <Command {...root}>
      <CommandInput aria-label="Search fruit" placeholder="Search" />
      <CommandEmpty>No fruit</CommandEmpty>
      <CommandList>
        <CommandGroup heading="Fruit">
          <CommandItem value="apple" onSelect={onSelect}>
            Apple
          </CommandItem>
          <CommandItem value="banana" keywords={["yellow"]} onSelect={onSelect}>
            Banana
          </CommandItem>
          <CommandItem value="cherry" disabled onSelect={onSelect}>
            Cherry
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

describe("Command", () => {
  it("renders ui-sdk slots, no cmdk or data-state attributes", async () => {
    const { container } = render(<Fruit />)
    await settle()
    for (const slot of ["command", "command-list", "command-group", "command-item"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
    }
    expect(container.querySelector("[cmdk-root],[cmdk-item],[data-state]")).toBeNull()
    expect(screen.getByRole("combobox", { name: "Search fruit" })).toBeInTheDocument()
  })

  it("renders the group heading", async () => {
    render(<Fruit />)
    await settle()
    expect(screen.getByText("Fruit")).toHaveAttribute("data-slot", "command-group-label")
    expect(screen.getByRole("group", { name: "Fruit" })).toBeInTheDocument()
  })

  it("filters by value and keywords with the built-in fuzzy filter, and shows the empty state", async () => {
    render(<Fruit />)
    await settle()
    type("ban")
    await settle()
    expect(screen.queryByRole("option", { name: "Apple" })).toBeNull()
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()
    type("yell")
    await settle()
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()
    type("zzz")
    await settle()
    expect(screen.queryByRole("option")).toBeNull()
    expect(screen.getByText("No fruit")).toBeInTheDocument()
    expect(screen.getByText("No fruit").closest("[role=listbox]")).toBeNull()
  })

  it("keeps every item with shouldFilter={false}", async () => {
    render(<Fruit shouldFilter={false} />)
    type("zzz")
    await settle()
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })

  it("highlights the first item, moves with the arrow keys and loops", async () => {
    render(<Fruit />)
    await settle()
    const input = screen.getByRole("combobox")
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute("data-highlighted")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute("data-highlighted")
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Banana" }).id)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute("data-highlighted")
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute("data-highlighted")
  })

  it("does not wrap with loop={false}", async () => {
    render(<Fruit loop={false} />)
    await settle()
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" })
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute("data-highlighted")
  })

  it("calls onSelect with the item value on Enter and on click, not for disabled items", async () => {
    const onSelect = vi.fn()
    render(<Fruit onSelect={onSelect} />)
    await settle()
    const input = screen.getByRole("combobox")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSelect).toHaveBeenLastCalledWith("banana")
    fireEvent.click(screen.getByRole("option", { name: "Apple" }))
    expect(onSelect).toHaveBeenLastCalledWith("apple")
    fireEvent.click(screen.getByRole("option", { name: "Cherry" }))
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it("falls back to the item text when it has no value", async () => {
    const onSelect = vi.fn()
    render(
      <Command>
        <CommandInput aria-label="Find" />
        <CommandList>
          <CommandItem onSelect={onSelect}>Plain Text</CommandItem>
        </CommandList>
      </Command>
    )
    await settle()
    fireEvent.click(screen.getByRole("option", { name: "Plain Text" }))
    expect(onSelect).toHaveBeenCalledWith("Plain Text")
  })

  it("reports the highlighted value through the root onValueChange", async () => {
    const onValueChange = vi.fn()
    render(<Fruit onValueChange={onValueChange} />)
    await settle()
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe("banana")
  })

  it("with a controlled root value and autoHighlight off, highlights nothing until moved", async () => {
    function Controlled() {
      const [v, setV] = useState("")
      return <Fruit value={v} onValueChange={(x) => setV(x)} autoHighlight={false} />
    }
    render(<Controlled />)
    await settle()
    expect(document.querySelector("[data-highlighted]")).toBeNull()
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })
    expect(document.querySelector("[data-highlighted]")).not.toBeNull()
  })

  it("controls the input text through value/onValueChange", async () => {
    const seen: string[] = []
    function Controlled() {
      const [q, setQ] = useState("")
      return (
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search"
            value={q}
            onValueChange={(x) => {
              seen.push(x)
              setQ(x.toUpperCase())
            }}
          />
          <CommandList>
            <CommandItem value="a">A</CommandItem>
          </CommandList>
        </Command>
      )
    }
    render(<Controlled />)
    type("abc")
    await settle()
    expect(seen).toEqual(["abc"])
    expect(screen.getByRole("combobox")).toHaveValue("ABC")
  })

  it("shows a CommandShortcut and a separator", async () => {
    render(
      <Command>
        <CommandInput aria-label="Find" />
        <CommandList>
          <CommandItem value="one">
            One <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandSeparator />
          <CommandItem value="two">Two</CommandItem>
        </CommandList>
      </Command>
    )
    await settle()
    expect(screen.getByText("⌘K")).toHaveAttribute("data-slot", "command-shortcut")
    expect(document.querySelector('[data-slot="command-separator"]')).not.toBeNull()
  })
})

describe("CommandDialog", () => {
  it("names the dialog by its title", () => {
    render(
      <CommandDialog open title="Find a page" description="Jump anywhere">
        <Command>
          <CommandInput aria-label="Search pages" />
        </Command>
      </CommandDialog>
    )
    expect(screen.getByRole("dialog", { name: "Find a page" })).toBeInTheDocument()
  })
})
