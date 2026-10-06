"use client";

import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { DataTable, DataTableSkeleton, ListPagination, type Column, type SortState } from "@foundry/design-system";
import { TableCell } from "@foundry/ui/table";

export type WalletLedgerColumn = "time" | "user" | "event" | "source" | "coins" | "order" | "memo";

/** One ledger line, already formatted by the app (functions can't cross into a client component). */
export type WalletLedgerRow = {
  publicId: string;
  when: string;
  direction: "credit" | "debit";
  eventLabel: string | null;
  sourceType: string;
  coins: number;
  memo: string | null;
  who: string | null;
  orderLabel: string | null;
  orderHref: string | null;
};

function columns(orderColumnLabel: string): readonly Column<WalletLedgerColumn>[] {
  return [
    { key: "time", label: "Time", sortable: true },
    { key: "user", label: "User", sortable: true },
    { key: "event", label: "Event", sortable: true },
    { key: "source", label: "Source", sortable: true },
    { key: "coins", label: "Coins", sortable: true, align: "right" },
    { key: "order", label: orderColumnLabel, sortable: true },
    { key: "memo", label: "Memo", sortable: true },
  ];
}

export function WalletLedgerTable({
  rows,
  sort,
  page,
  size,
  total,
  orderColumnLabel = "Order",
}: {
  rows: WalletLedgerRow[];
  sort?: SortState<WalletLedgerColumn>;
  page: number;
  size: number;
  total: number;
  orderColumnLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <DataTable
        serialOffset={page * size}
        columns={columns(orderColumnLabel)}
        rows={rows}
        rowKey={(r) => r.publicId}
        sort={sort}
        search={{ placeholder: "Search ledger…", shortPlaceholder: "Search…", debounceMs: 300 }}
        emptyIcon={ScrollTextIcon}
        emptyMessage="No wallet activity yet. Earns and redemptions will appear here."
        renderRow={(r) => {
          const credit = r.direction === "credit";
          return (
            <>
              <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{r.when}</TableCell>
              <TableCell className="text-muted-foreground">{r.who ?? "—"}</TableCell>
              <TableCell>{r.eventLabel ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.sourceType}</TableCell>
              <TableCell className={`text-right tabular-nums ${credit ? "text-ok" : "text-bad"}`}>
                {credit ? "+" : "−"}
                {r.coins}
              </TableCell>
              <TableCell>
                {r.orderHref && r.orderLabel ? (
                  <Link href={r.orderHref} className="text-muted-foreground hover:underline">
                    {r.orderLabel}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{r.orderLabel ?? "—"}</span>
                )}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{r.memo ?? ""}</TableCell>
            </>
          );
        }}
      />
      <ListPagination page={page} size={size} total={total} />
    </div>
  );
}

export function WalletLedgerTableSkeleton({ orderColumnLabel = "Order" }: { orderColumnLabel?: string }) {
  return <DataTableSkeleton columns={columns(orderColumnLabel)} />;
}
