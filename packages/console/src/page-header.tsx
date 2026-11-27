"use client"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@foundry/ui/breadcrumb"
import { SidebarTrigger } from "@foundry/ui/sidebar"
import { Fragment, useEffect, type ReactNode } from "react"
import { useConsoleShell } from "./app-shell"
import { ConsoleLink, type ConsoleSearch } from "./router"

export type Crumb = { label: string; to?: string; search?: ConsoleSearch }

export function PageHeader({
  crumbs,
  badge,
  actions,
  description,
}: {
  crumbs: Crumb[]
  badge?: ReactNode
  actions?: ReactNode
  description?: string
}) {
  const { appName } = useConsoleShell()
  const last = crumbs.length - 1
  const title = crumbs[last]?.label

  useEffect(() => {
    if (title) document.title = `${title} · ${appName}`
  }, [title, appName])

  return (
    <>
      <header className="border-b">
        <div className="flex h-14 items-center gap-2 px-3">
          <SidebarTrigger size="icon" className="md:hidden" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, i) => (
                <Fragment key={i}>
                  {i > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {i < last && crumb.to ? (
                      <BreadcrumbLink render={<ConsoleLink to={crumb.to} search={crumb.search} />}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pt-8 pb-6">
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-3xl font-semibold tracking-tight">{title}</h1>
              {badge}
            </div>
            {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </>
  )
}
