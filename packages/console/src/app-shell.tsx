"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@foundry/ui/sidebar"
import { createContext, Fragment, useContext, useEffect, type ReactNode } from "react"
import { activeItem, type NavGroup } from "./nav"
import { ConsoleLink, useConsoleRouter } from "./router"

const ShellContext = createContext<{ appName: string } | null>(null)

export function useConsoleShell(): { appName: string } {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error("AppShell is missing")
  return shell
}

function CloseOnNavigate() {
  const { usePathname } = useConsoleRouter()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile])
  return null
}

function Groups({ nav }: { nav: NavGroup[] }) {
  const pathname = useConsoleRouter().usePathname()
  const active = activeItem(nav, pathname)
  return (
    <>
      {nav.map((group, i) => (
        <Fragment key={group.label ?? i}>
          {i > 0 ? <SidebarSeparator /> : null}
          <SidebarGroup>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const current = item === active
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={current}
                        tooltip={item.label}
                        render={<ConsoleLink to={item.to} aria-current={current ? "page" : undefined} />}
                      >
                        {item.icon ? <item.icon /> : null}
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge != null ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Fragment>
      ))}
    </>
  )
}

export function AppShell({
  appName,
  brand,
  nav,
  user,
  userMenu,
  children,
}: {
  appName: string
  brand: ReactNode
  nav: NavGroup[]
  user: { name: string; email: string }
  userMenu: ReactNode
  children: ReactNode
}) {
  return (
    <ShellContext.Provider value={{ appName }}>
      <SidebarProvider>
        <CloseOnNavigate />
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader>{brand}</SidebarHeader>
          <SidebarContent className="overflow-x-hidden">
            <Groups nav={nav} />
          </SidebarContent>
          <SidebarFooter>
            <div className="grid min-w-0 px-2 text-sm group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground">{user.email}</span>
            </div>
            {userMenu}
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,72rem)_minmax(0,1fr)] [&>:not(header)]:col-start-2 [&>:not(header)]:min-w-0 [&>header]:col-span-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ShellContext.Provider>
  )
}
