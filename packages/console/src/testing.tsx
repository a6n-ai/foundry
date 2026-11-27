import type { ConsoleNavigate, ConsoleRouter, ConsoleSearch } from "./router"

export function createMemoryConsoleRouter({
  pathname = "/",
  search = {},
}: { pathname?: string; search?: ConsoleSearch } = {}): ConsoleRouter & { calls: Parameters<ConsoleNavigate>[0][] } {
  const calls: Parameters<ConsoleNavigate>[0][] = []
  return {
    calls,
    Link({ to, search, replace: _replace, ...rest }) {
      const qs = new URLSearchParams(
        Object.entries(search ?? {}).flatMap(([k, v]) => (v === undefined || v === null ? [] : [[k, String(v)]])),
      ).toString()
      return <a href={qs ? `${to}?${qs}` : to} {...rest} />
    },
    useSearch: () => search,
    usePathname: () => pathname,
    useNavigate: () => (target) => {
      calls.push(target)
    },
  }
}
