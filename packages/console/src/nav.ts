import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type NavItem = { label: string; to: string; icon?: LucideIcon; badge?: ReactNode; exact?: boolean }
export type NavGroup = { label?: string; items: NavItem[] }

const matches = (item: NavItem, pathname: string) =>
  pathname === item.to || (!item.exact && item.to !== "/" && pathname.startsWith(`${item.to}/`))

export function activeItem(groups: NavGroup[], pathname: string): NavItem | undefined {
  return groups
    .flatMap((g) => g.items)
    .filter((i) => matches(i, pathname))
    .sort((a, b) => b.to.length - a.to.length)[0]
}
