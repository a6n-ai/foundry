import type { ResourceLabel } from "../org-roles/permission-map";

export type AccessLevel = "none" | "view" | "edit" | "full";

export function accessLevel(held: readonly string[], areaActions: readonly string[]): AccessLevel {
  const inArea = areaActions.filter((a) => held.includes(a));
  if (inArea.length === 0) return "none";
  if (inArea.length === areaActions.length) return "full";
  if (inArea.length === 1 && inArea[0] === "read") return "view";
  return "edit";
}

export type AccessRow = {
  id: string;
  name: string;
  email: string | null;
  roles: string[];
  permissions: Record<string, string[]>;
  grants: Record<string, Record<string, string[]>>;
};

export type WhoCanHit = {
  resource: string;
  resourceLabel: string;
  action: string;
  label: string;
  holders: { rowId: string; roles: string[] }[];
};

export function whoCan(rows: AccessRow[], resources: ResourceLabel[], query: string): WhoCanHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: WhoCanHit[] = [];
  for (const r of resources) {
    const resourceMatch = r.label.toLowerCase().includes(q);
    for (const a of r.actions) {
      const matches = resourceMatch || a.label.toLowerCase().includes(q) || a.action.toLowerCase().includes(q);
      if (!matches) continue;
      const holders = rows
        .filter((row) => row.permissions[r.resource]?.includes(a.action))
        .map((row) => {
          const granting = row.grants[r.resource]?.[a.action] ?? [];
          return { rowId: row.id, roles: row.roles.filter((role) => granting.includes(role)) };
        });
      hits.push({ resource: r.resource, resourceLabel: r.label, action: a.action, label: a.label, holders });
    }
  }
  return hits;
}
