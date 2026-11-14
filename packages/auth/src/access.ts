import type { Role } from "better-auth/plugins/access";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import {
  adminAc as orgAdminAc,
  defaultStatements as orgDefaultStatements,
  memberAc as orgMemberAc,
  ownerAc as orgOwnerAc,
} from "better-auth/plugins/organization/access";

// Resources every Realm CRM has. App-specific resources (product, order, …) are
// added by each app's own permissions.ts, which spreads this in.
export const crmStatements = {
  settings: ["read", "write"],
  audit: ["read"],
} as const;

// defaultStatements carries better-auth's own `user` and `session` resources, which
// the admin plugin's endpoints check against. Dropping them would leave createUser
// and setRole permanently forbidden.
export const baseStatement = { ...defaultStatements, ...crmStatements } as const;

export { createAccessControl, adminAc, defaultStatements };
export type { Role } from "better-auth/plugins/access";

// Renamed: `defaultStatements` already names the admin plugin's statement above.
export { orgDefaultStatements };

type ActionMap = Record<string, readonly string[]>;

// Per-resource union, so an app resource that shares a name with an org resource
// adds actions instead of replacing the owner/admin ones.
function mergeActions(base: ActionMap, extra: ActionMap): ActionMap {
  const out: ActionMap = { ...base };
  for (const [resource, actions] of Object.entries(extra)) {
    out[resource] = [...new Set([...(out[resource] ?? []), ...actions])];
  }
  return out;
}

export function createOrgStatement<const S extends ActionMap>(app: S) {
  return { ...baseStatement, ...orgDefaultStatements, ...app } as typeof baseStatement &
    typeof orgDefaultStatements &
    S;
}

export function createOrgRoles<const S extends ActionMap>(
  ac: ReturnType<typeof createAccessControl>,
  appStatement: S,
  memberPermissions: ActionMap,
): { owner: Role; admin: Role; member: Role } {
  return {
    owner: ac.newRole(mergeActions(orgOwnerAc.statements, appStatement)),
    admin: ac.newRole(mergeActions(orgAdminAc.statements, appStatement)),
    member: ac.newRole(mergeActions(orgMemberAc.statements, memberPermissions)),
  };
}
