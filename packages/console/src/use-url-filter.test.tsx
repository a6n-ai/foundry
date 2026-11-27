// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConsoleRouterProvider, type ConsoleSearch } from "./router"
import { createMemoryConsoleRouter } from "./testing"
import { useUrlFilter } from "./use-url-filter"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const setup = (search: ConsoleSearch) => {
  const router = createMemoryConsoleRouter({ search })
  const wrapper = ({ children }: { children: ReactNode }) => <ConsoleRouterProvider router={router}>{children}</ConsoleRouterProvider>
  return { router, wrapper }
}

describe("useUrlFilter", () => {
  it("navigates once after the delay with replace", () => {
    const { router, wrapper } = setup({})
    const { result } = renderHook(() => useUrlFilter("q", { reset: ["page"] }), { wrapper })
    act(() => result.current[1]("acme"))
    act(() => void vi.advanceTimersByTime(299))
    expect(router.calls).toHaveLength(0)
    act(() => void vi.advanceTimersByTime(1))
    expect(router.calls).toHaveLength(1)
    const call = router.calls[0]!
    expect(call.replace).toBe(true)
    expect((call.search as (p: ConsoleSearch) => ConsoleSearch)({ page: 2 })).toEqual({ q: "acme" })
  })

  it("follows a URL change", () => {
    let search: ConsoleSearch = { q: "alpha" }
    const router = { ...createMemoryConsoleRouter(), useSearch: () => search }
    const wrapper = ({ children }: { children: ReactNode }) => <ConsoleRouterProvider router={router}>{children}</ConsoleRouterProvider>
    const { result, rerender } = renderHook(() => useUrlFilter("q"), { wrapper })
    expect(result.current[0]).toBe("alpha")
    search = { q: "beta" }
    rerender()
    expect(result.current[0]).toBe("beta")
  })
})
