// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TableCell } from "@foundry/ui/table"
import { DataTable, DataTableSkeleton } from "./data-table"

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

afterEach(cleanup)

const columns = [{ key: "amount", label: "Amount" }] as const
const rows = [{ id: "1", amount: "12.00" }]

const frameOf = (el: HTMLElement) => el.closest('[data-slot="table-container"]')!.parentElement as HTMLElement

describe("DataTable frame", () => {
  it("rounds the admin frame with the table frame radius token and drops the nested ring", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        renderRow={(r) => <TableCell>{r.amount}</TableCell>}
        emptyIcon={Inbox}
        emptyMessage="No orders"
      />
    )
    const frame = frameOf(screen.getAllByText("12.00")[0])
    expect(frame).toHaveClass("rounded-(--ui-table-frame-radius)", "border")
    expect(frame.className).not.toContain("rounded-lg")
    expect(frame).toHaveClass("[&_[data-slot=table-container]]:ring-transparent")
  })
})

describe("DataTableSkeleton frame", () => {
  it("rounds the skeleton frame with the table frame radius token and drops the nested ring", () => {
    const { container } = render(<DataTableSkeleton columns={columns} rows={1} />)
    const frame = container.querySelector('[data-slot="table-container"]')!.parentElement as HTMLElement
    expect(frame).toHaveClass("rounded-(--ui-table-frame-radius)", "border")
    expect(frame.className).not.toContain("rounded-lg")
    expect(frame).toHaveClass("[&_[data-slot=table-container]]:ring-transparent")
  })
})
