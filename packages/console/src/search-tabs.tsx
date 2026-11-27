"use client"

import { ConsoleLink, useConsoleRouter } from "./router"

export function SearchTabs({
  param,
  tabs,
  reset = [],
}: {
  param: string
  tabs: { value: string; label: string; count?: number }[]
  reset?: string[]
}) {
  const { useSearch, usePathname } = useConsoleRouter()
  const search = useSearch()
  const pathname = usePathname()
  const current = search[param] == null ? tabs[0]?.value : String(search[param])
  return (
    <nav aria-label="Views" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.value === current
        const next = { ...search, [param]: tab.value }
        for (const key of reset) delete next[key]
        return (
          <ConsoleLink
            key={tab.value}
            to={pathname}
            search={next}
            aria-current={active ? "page" : undefined}
            data-active={active}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
          >
            {tab.label}
            {tab.count != null ? <span className="text-xs tabular-nums text-muted-foreground">{tab.count}</span> : null}
          </ConsoleLink>
        )
      })}
    </nav>
  )
}
