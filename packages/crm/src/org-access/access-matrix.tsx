"use client";

import type { ReactNode } from "react";
import { Badge } from "@foundry/ui/badge";
import { Button } from "@foundry/ui/button";
import { cn } from "@foundry/ui/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@foundry/ui/table";
import type { ResourceLabel } from "../org-roles/permission-map";
import { accessLevel, type AccessRow } from "./access-model";
import { AccessLevelCell } from "./access-level-cell";

export type AccessMatrixProps = {
  rows: AccessRow[];
  resources: ResourceLabel[];
  /** Row ids of platform admins; they show a badge and cannot be restricted here. */
  platformAdmins: readonly string[];
  highlight?: string;
  onRowOpen: (rowId: string) => void;
  /** Editing surface for a row, rendered in the mobile card list. */
  renderChips: (row: AccessRow) => ReactNode;
  emptyState?: ReactNode;
};

function NameButton({ row, isAdmin, onOpen }: { row: AccessRow; isAdmin: boolean; onOpen: () => void }) {
  return (
    <div className="grid gap-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="link" className="h-auto p-0 text-sm font-medium" onClick={onOpen}>
          {row.name}
        </Button>
        {isAdmin && <Badge variant="secondary">Platform admin</Badge>}
      </div>
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
  if (rows.length === 0) return <>{emptyState ?? <p className="text-sm text-muted-foreground">No members yet.</p>}</>;

  const admins = new Set(platformAdmins);

  return (
    <div className="grid gap-4">
      <div className="hidden overflow-x-auto md:block">
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
              <TableRow key={row.id} className={cn(highlight === row.id && "bg-muted")}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <NameButton row={row} isAdmin={admins.has(row.id)} onOpen={() => onRowOpen(row.id)} />
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
            className={cn("grid gap-3 rounded-lg border p-4", highlight === row.id && "bg-muted")}
          >
            <NameButton row={row} isAdmin={admins.has(row.id)} onOpen={() => onRowOpen(row.id)} />
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
