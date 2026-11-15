"use client";

import type { ReactNode } from "react";
import { cn } from "@foundry/ui/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@foundry/ui/table";
import type { ResourceLabel } from "../org-roles/permission-map";
import { accessLevel, type AccessRow } from "./access-model";
import { AccessLevelCell } from "./access-level-cell";

export type AccessMatrixProps = {
  rows: AccessRow[];
  resources: ResourceLabel[];
  /** Super admins with full access. They are not org rows, so they are listed above the table. */
  platformAdmins: { name: string; email: string | null }[];
  highlight?: string;
  onRowOpen: (rowId: string) => void;
  /** Editing surface for a row. Rendered only in the mobile card list; desktop edits go through onRowOpen. */
  renderChips: (row: AccessRow) => ReactNode;
  emptyState: ReactNode;
};

function NameButton({ row, onOpen }: { row: AccessRow; onOpen: () => void }) {
  return (
    <div className="grid gap-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="justify-self-start text-left text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
      >
        {row.name}
      </button>
      {row.email && <span className="text-xs text-muted-foreground">{row.email}</span>}
    </div>
  );
}

export function AccessMatrix({
  rows,
  resources,
  platformAdmins,
  highlight,
  onRowOpen,
  renderChips,
  emptyState,
}: AccessMatrixProps) {
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className="grid gap-4">
      {platformAdmins.length > 0 && (
        <section className="grid gap-2">
          <p className="text-sm font-medium">Platform admins (full access)</p>
          <ul className="grid gap-0.5">
            {platformAdmins.map((a) => (
              <li key={`${a.name}-${a.email}`} className="text-sm text-muted-foreground">
                {a.name}
                {a.email && ` · ${a.email}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">Person</TableHead>
              {resources.map((r) => (
                <TableHead key={r.resource}>{r.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                aria-current={highlight === row.id || undefined}
                className={cn(highlight === row.id && "bg-muted")}
              >
                <TableCell className={cn("sticky left-0 z-10", highlight === row.id ? "bg-muted" : "bg-background")}>
                  <NameButton row={row} onOpen={() => onRowOpen(row.id)} />
                </TableCell>
                {resources.map((r) => {
                  const held = row.permissions[r.resource] ?? [];
                  return (
                    <TableCell key={r.resource}>
                      <AccessLevelCell
                        level={accessLevel(held, r.actions.map((a) => a.action))}
                        actions={r.actions.filter((a) => held.includes(a.action))}
                        grants={row.grants[r.resource] ?? {}}
                        resourceLabel={r.label}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            aria-current={highlight === row.id || undefined}
            className={cn("grid gap-3 rounded-lg border p-4", highlight === row.id && "bg-muted")}
          >
            <NameButton row={row} onOpen={() => onRowOpen(row.id)} />
            <ul className="grid gap-1">
              {resources.map((r) => {
                const held = row.permissions[r.resource] ?? [];
                return (
                  <li key={r.resource} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <AccessLevelCell
                      level={accessLevel(held, r.actions.map((a) => a.action))}
                      actions={r.actions.filter((a) => held.includes(a.action))}
                      grants={row.grants[r.resource] ?? {}}
                      resourceLabel={r.label}
                    />
                  </li>
                );
              })}
            </ul>
            {renderChips(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
