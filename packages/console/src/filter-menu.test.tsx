// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FilterMenu } from "./filter-menu"

afterEach(cleanup)

const facets = [{ key: "status", label: "Status", options: [{ value: "open", label: "Open" }] }]

describe("FilterMenu", () => {
  it("drops page and cursor on a filter change by default", () => {
    const onChange = vi.fn()
    render(<FilterMenu facets={facets} value={{ status: "open", page: "3", cursor: "c1", q: "x" }} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove Status filter" }))
    expect(onChange).toHaveBeenCalledWith({ q: "x" })
  })

  it("honours a custom reset list", () => {
    const onChange = vi.fn()
    render(<FilterMenu facets={facets} value={{ status: "open", page: "3", q: "x" }} onChange={onChange} reset={["q"]} />)
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(onChange).toHaveBeenCalledWith({ page: "3" })
  })
})
