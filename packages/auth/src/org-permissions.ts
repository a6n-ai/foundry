import { ForbiddenError } from "@foundry/commons";
import type { Role } from "better-auth/plugins/access";
import type { createAccessControl } from "./access";

export type Permissions = Record<string, string[]>;
export type OrgAccess =
  | { kind: "platform"; userId: string }
  | { kind: "member"; userId: string; organizationId: string; roles: Role[] }
  | { kind: "none" };

export function resolveOrgAccess(input: {
  platformRole: string | null;
  userId: string;
  organizationId: string | null;
  memberRole: string | null;
  customRoles: Record<string, Permissions>;
  roles: Record<string, Role>;
  ac: ReturnType<typeof createAccessControl>;
}): OrgAccess {
  if (input.platformRole === "super_admin") return { kind: "platform", userId: input.userId };
  if (!input.organizationId) return { kind: "none" };
  const roles: Role[] = [];
  for (const raw of (input.memberRole ?? "").split(",")) {
    const name = raw.trim();
    if (!name) continue;
    // Object.hasOwn: a role named "constructor" must not resolve via the prototype.
    if (Object.hasOwn(input.roles, name)) roles.push(input.roles[name]);
    else if (Object.hasOwn(input.customRoles, name)) roles.push(input.ac.newRole(input.customRoles[name]));
  }
  return { kind: "member", userId: input.userId, organizationId: input.organizationId, roles };
}

// Mirrors better-auth's hasPermissionFn: any single role must authorize the full set.
export function accessAllows(access: OrgAccess, perms: Permissions): boolean {
  if (access.kind === "platform") return true;
  if (access.kind === "none") return false;
  return access.roles.some((r) => r.authorize(perms).success);
}

export function createOrgPermissionGuards(deps: {
  getAccess: () => Promise<OrgAccess>;
  onPlatformBypass?: (userId: string, perms: Permissions) => Promise<void>;
}) {
  async function can(perms: Permissions): Promise<boolean> {
    const access = await deps.getAccess();
    return accessAllows(access, perms);
  }

  // Only the gate audits: can() also drives nav/UI, which would write a row per menu item.
  async function requirePermission(perms: Permissions): Promise<void> {
    const access = await deps.getAccess();
    if (!accessAllows(access, perms)) throw new ForbiddenError();
    if (access.kind === "platform") await deps.onPlatformBypass?.(access.userId, perms);
  }

  return { can, requirePermission };
}
