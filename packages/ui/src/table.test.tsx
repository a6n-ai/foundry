// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

afterEach(cleanup)

const tokens = readFileSync(resolve(process.cwd(), "../themes/src/tokens.css"), "utf8")
const block = (selector: string) => {
  const start = tokens.indexOf(`\n${selector} {`)
  return tokens.slice(start, tokens.indexOf("\n}", start))
}
const rootBlock = block(":root")
const adminBlock = block(".admin-ui, body:has(.admin-ui)")

const renderTable = (variant?: "default" | "striped" | "bordered" | "interactive") =>
  render(
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )

describe("Table variants", () => {
  it("default adds no striping, rules or row-hover class", () => {
    renderTable()
    const table = screen.getByRole("table")
    expect(table.className).not.toMatch(/nth-child|border-r|tbody_tr:hover|transition-none/)
  })

  it("striped shades even body rows", () => {
    renderTable("striped")
    expect(screen.getByRole("table")).toHaveClass(
      "[&_tbody_tr:nth-child(even):not(:hover):not([data-state=selected])]:bg-muted/30"
    )
  })

  it("bordered draws vertical cell rules and none after the last column", () => {
    renderTable("bordered")
    expect(screen.getByRole("table")).toHaveClass(
      "[&_th]:border-r",
      "[&_td]:border-r",
      "[&_th:last-child]:border-r-0",
      "[&_td:last-child]:border-r-0"
    )
  })

  it("interactive lifts body rows to muted/60 on hover with no colour transition", () => {
    renderTable("interactive")
    const table = screen.getByRole("table")
    expect(table).toHaveClass("[&_tbody_tr:not([data-table-empty]):hover]:bg-muted/60", "[&_tbody_tr]:transition-none")
    expect(table.className).not.toContain("transition-colors")
  })
})

describe("Table numeric and mono cells", () => {
  it("numeric cells and heads take tabular figures without a font swap", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead numeric>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell numeric>£12.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const head = screen.getByText("Amount")
    const cell = screen.getByText("£12.00")
    expect(head).toHaveClass("tabular-nums")
    expect(cell).toHaveClass("tabular-nums")
    expect(cell.className).not.toContain("font-mono")
    expect(cell).not.toHaveAttribute("numeric")
    expect(head).not.toHaveAttribute("numeric")
  })

  it("mono cells take the Geist Mono face", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell mono>ORD-1042</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const cell = screen.getByText("ORD-1042")
    expect(cell).toHaveClass("font-mono")
    expect(cell).not.toHaveAttribute("mono")
  })

  it("plain cells and heads take neither class", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Plain</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText("Plain").className).not.toMatch(/tabular-nums|font-mono/)
  })
})

describe("Table reads the --ui-table-* tokens", () => {
  it("the wrapper takes the table radius, surface and hairline ring tokens, with no shadow", () => {
    renderTable()
    const wrapper = screen.getByRole("table").parentElement as HTMLElement
    expect(wrapper).toHaveClass(
      "rounded-(--ui-table-radius)",
      "bg-[color:var(--ui-table-surface)]",
      "ring-1",
      "ring-[color:var(--ui-table-ring)]"
    )
    expect(wrapper.className).not.toMatch(/shadow/)
  })

  it("the header reads the head size, colour and background tokens", () => {
    renderTable()
    const head = screen.getByText("Name")
    expect(head).toHaveClass(
      "text-(length:--ui-table-head-size)",
      "text-[color:var(--ui-table-head-color)]",
      "font-medium"
    )
    expect(head.closest("thead")).toHaveClass("bg-[color:var(--ui-table-head-bg)]")
  })

  it("the rows read the row height and hover tokens and the table reads the font size token", () => {
    renderTable()
    expect(screen.getByText("Ada").closest("tr")).toHaveClass(
      "h-(--ui-table-row-height)",
      "hover:bg-[color:var(--ui-table-row-hover)]"
    )
    expect(screen.getByRole("table")).toHaveClass("text-(length:--ui-table-font-size)")
  })
})

describe("Table token values", () => {
  it("customer :root keeps today's table look", () => {
    expect(rootBlock).toContain("--ui-table-radius: 0px;")
    expect(rootBlock).toContain("--ui-table-frame-radius: var(--radius-lg);")
    expect(rootBlock).toContain("--ui-table-surface: transparent;")
    expect(rootBlock).toContain("--ui-table-ring: transparent;")
    expect(rootBlock).toContain("--ui-table-font-size: 0.875rem;")
    expect(rootBlock).toContain("--ui-table-head-size: 0.875rem;")
    expect(rootBlock).toContain("--ui-table-head-color: var(--foreground);")
    expect(rootBlock).toContain("--ui-table-head-bg: transparent;")
    expect(rootBlock).toContain("--ui-table-row-height: auto;")
    expect(rootBlock).toContain("--ui-table-row-hover: color-mix(in oklab, var(--muted) 50%, transparent);")
  })

  it("admin takes the Geist table values", () => {
    expect(adminBlock).toContain("--ui-table-radius: var(--ui-radius-card);")
    expect(adminBlock).toContain("--ui-table-frame-radius: var(--ui-radius-card);")
    expect(adminBlock).toContain("--ui-table-surface: var(--card);")
    expect(adminBlock).toContain("--ui-table-ring: var(--border);")
    expect(adminBlock).toContain("--ui-table-font-size: 0.8125rem;")
    expect(adminBlock).toContain("--ui-table-head-size: 0.75rem;")
    expect(adminBlock).toContain("--ui-table-head-color: var(--muted-foreground);")
    expect(adminBlock).toContain("--ui-table-head-bg: color-mix(in oklab, var(--muted) 40%, transparent);")
    expect(adminBlock).toContain("--ui-table-row-height: 2.75rem;")
    expect(adminBlock).toContain("--ui-table-row-hover: transparent;")
  })
})
