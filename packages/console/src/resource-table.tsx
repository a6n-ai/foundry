import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@foundry/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@foundry/ui/tooltip"
import type { ReactNode } from "react"
import { ConsoleLink, type ConsoleLinkProps } from "./router"
import { type RowAction, RowMenu } from "./row-menu"

const KIND = { name: "font-medium", mono: "font-mono text-xs", url: "break-all font-mono text-xs", time: "text-xs tabular-nums" } as const

// Only real controls sit above the row's overlay link; text, names and badges fall through to it.
const ROW_LINK =
  "relative hover:bg-muted/50 [&_td_:is(a,button,input,select,textarea,label,[role=switch],[role=checkbox],[role=combobox],[role=menuitem]):not([data-row-link])]:relative [&_td_:is(a,button,input,select,textarea,label,[role=switch],[role=checkbox],[role=combobox],[role=menuitem]):not([data-row-link])]:z-10"

export type Column<T> = { header: string; cell: (row: T) => ReactNode; numeric?: boolean; kind?: keyof typeof KIND; secondary?: boolean }

// Secondary columns drop out under sm, so a phone never cuts a cell mid-word.
const cellClass = (c: { numeric?: boolean; secondary?: boolean }) =>
  [c.numeric && "text-right tabular-nums", c.secondary && "hidden sm:table-cell"].filter(Boolean).join(" ") || undefined

const inset = "px-4 pb-4 in-data-[slot=card-content]:p-0"

export function CellWhen({ when, text }: { when: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="tabular-nums" />}>{text}</TooltipTrigger>
      <TooltipContent>{when}</TooltipContent>
    </Tooltip>
  )
}

export function ResourceTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  rowHref,
  rowLabel,
  menu,
  offset = 0,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: ReactNode
  rowHref?: (row: T) => ConsoleLinkProps
  rowLabel?: (row: T) => string
  menu?: (row: T) => RowAction[]
  offset?: number
}) {
  if (rows.length === 0)
    return (
      <div className={inset}>
        <Table>
          <TableBody>
            <TableRow data-table-empty>
              <TableCell colSpan={columns.length + 1 + (menu ? 1 : 0)}>
                {typeof empty === "string" ? <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p> : empty}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  return (
    <div className={inset}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            {columns.map((c) => (
              <TableHead key={c.header} className={cellClass(c)}>
                {c.header}
              </TableHead>
            ))}
            {menu ? <TableHead className="w-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const href = rowHref?.(row)
            return (
              <TableRow key={rowKey(row)} className={href ? ROW_LINK : undefined}>
                <TableCell className="w-10 text-muted-foreground tabular-nums">{offset + index + 1}</TableCell>
                {columns.map((c, i) => (
                  <TableCell key={c.header} className={cellClass(c)}>
                    {c.kind ? <span className={KIND[c.kind]}>{c.cell(row)}</span> : c.cell(row)}
                    {href && i === 0 ? (
                      <ConsoleLink
                        {...href}
                        data-row-link
                        aria-label={rowLabel?.(row) ?? "Open"}
                        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    ) : null}
                  </TableCell>
                ))}
                {menu ? (
                  <TableCell className="w-10 py-0 text-right">
                    <RowMenu actions={menu(row)} label="Row actions" />
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
