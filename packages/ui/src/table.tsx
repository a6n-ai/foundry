"use client"

import * as React from "react"

import { cn } from "./cn"

type TableVariant = "default" | "striped" | "bordered" | "interactive"

const tableVariants: Record<TableVariant, string> = {
  default: "",
  striped: "[&_tbody_tr:nth-child(even)]:bg-muted/30",
  bordered:
    "[&_th]:border-r [&_td]:border-r [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0",
  // shortcut: no transition on the row so the hover shade lands instantly, matching admin's no-transition rule
  interactive: "[&_tbody_tr]:transition-none [&_tbody_tr:not([data-table-empty]):hover]:bg-muted/60",
}

function Table({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"table"> & { variant?: TableVariant }) {
  return (
    <div
      data-slot="table-container"
      // Thin, theme-colored scrollbar instead of the browser's raw OS chrome —
      // a wide table (many columns) still needs to scroll, but shouldn't look
      // like it broke out of the design.
      className="relative w-full [&:has([data-table-empty])]:[container-type:inline-size] overflow-x-auto rounded-(--ui-table-radius) bg-[color:var(--ui-table-surface)] ring-1 ring-[color:var(--ui-table-ring)] [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <table
        data-slot="table"
        data-variant={variant}
        className={cn(
          "w-full caption-bottom text-(length:--ui-table-font-size) leading-5",
          tableVariants[variant],
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-[color:var(--ui-table-head-bg)] [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-(--ui-table-row-height) border-b transition-colors hover:bg-[color:var(--ui-table-row-hover)] has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-(length:--ui-table-head-size) text-[color:var(--ui-table-head-color)] [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
