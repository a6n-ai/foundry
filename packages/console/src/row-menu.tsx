"use client"

import { Button } from "@foundry/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@foundry/ui/dropdown-menu"
import { MoreHorizontalIcon } from "lucide-react"
import { ConsoleLink, type ConsoleSearch } from "./router"

export type RowAction = {
  label: string
  onSelect?: () => void
  to?: string
  search?: ConsoleSearch
  destructive?: boolean
  hidden?: boolean
}

export function RowMenu({ actions, label }: { actions: RowAction[]; label: string }) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null
  const normal = visible.filter((a) => !a.destructive)
  const destructive = visible.filter((a) => a.destructive)
  const item = (a: RowAction) => (
    <DropdownMenuItem
      key={a.label}
      variant={a.destructive ? "destructive" : "default"}
      onClick={a.onSelect}
      render={a.to ? <ConsoleLink to={a.to} search={a.search} /> : undefined}
    >
      {a.label}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={label} />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {normal.map(item)}
        {normal.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
