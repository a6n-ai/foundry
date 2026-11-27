// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { ConsoleRouterProvider } from "./router"
import { type Column, ResourceTable } from "./resource-table"
import { createMemoryConsoleRouter } from "./testing"

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

type Row = { id: string; name: string }
const columns: Column<Row>[] = [{ header: "Name", cell: (r) => r.name, kind: "name" }]
const rows: Row[] = [{ id: "inq_1", name: "Acme" }]

const show = (ui: React.ReactNode) => render(<ConsoleRouterProvider router={createMemoryConsoleRouter()}>{ui}</ConsoleRouterProvider>)

describe("ResourceTable", () => {
  it("renders cells", () => {
    show(<ResourceTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="None" />)
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("renders empty when no rows", () => {
    show(<ResourceTable columns={columns} rows={[]} rowKey={(r) => r.id} empty="Nothing yet" />)
    expect(screen.getByText("Nothing yet")).toBeInTheDocument()
  })

  it("row link carries to and search", () => {
    show(
      <ResourceTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty="None"
        rowHref={(r) => ({ to: "/inquiries/" + r.id, search: { from: "mine" } })}
        rowLabel={(r) => r.name}
      />,
    )
    expect(screen.getByRole("link", { name: "Open Acme" })).toHaveAttribute("href", "/inquiries/inq_1?from=mine")
  })

  it("renders menu actions", async () => {
    show(
      <ResourceTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty="None"
        rowLabel={(r) => r.name}
        menu={() => [{ label: "Rename" }, { label: "Delete", destructive: true }]}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Acme actions" }))
    await screen.findByRole("menu")
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument()
  })

  it("names the actions column, each row's link and menu, and the table", () => {
    const two: Row[] = [{ id: "inq_1", name: "Acme" }, { id: "inq_2", name: "Globex" }]
    show(
      <ResourceTable
        label="Inquiries"
        columns={columns}
        rows={two}
        rowKey={(r) => r.id}
        empty="None"
        rowHref={(r) => ({ to: "/inquiries/" + r.id })}
        rowLabel={(r) => r.name}
        menu={() => [{ label: "Rename" }]}
      />,
    )
    expect(screen.getByRole("table", { name: "Inquiries" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Acme" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Globex" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Acme actions" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Globex actions" })).toBeInTheDocument()
  })
})
