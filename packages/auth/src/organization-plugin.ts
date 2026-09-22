import { organization as organizationPlugin } from "better-auth/plugins";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { APIError } from "better-auth/api";
import { assertHierarchyDepth, type OrgParentRef } from "./organization";

export interface OrganizationPluginConfig {
  /** Drizzle db instance from the calling app — this package stays app-agnostic. */
  db: {
    select: (...args: unknown[]) => {
      from: (...args: unknown[]) => { where: (...args: unknown[]) => { limit: (n: number) => Promise<OrgParentRef[]> } };
    };
  };
  /** The app's `organization` Drizzle table (for the id/parentOrganizationId columns). */
  organizationTable: { id: unknown; parentOrganizationId: unknown };
  /** Drizzle `eq` — passed in rather than imported, so this package never depends on a specific drizzle-orm version resolution inside node_modules. */
  eq: (a: unknown, b: unknown) => unknown;
  /**
   * Gate on who may create a top-level org. Defaults to "any authenticated user
   * whose role is not Role.USER" — pass the app's own check when Role.USER isn't
   * the right customer marker (there isn't one today, but don't assume it forever).
   */
  allowUserToCreateOrganization: (user: { role?: string }) => boolean | Promise<boolean>;
  /** Extra fields beyond clientCode/parentOrganizationId/region, e.g. puchkaman's future Clover-linked fields. */
  additionalOrganizationFields?: Record<string, { type: string; required?: boolean; input?: boolean }>;
  /** Pass-through to better-auth's organization plugin — sends the branded staff-invite email. Optional: apps without staff invites yet can omit it. */
  sendInvitationEmail?: OrganizationOptions["sendInvitationEmail"];
}

/**
 * Client hierarchy: org = brand or franchise/shop, capped at 2 levels
 * (brand -> franchise/shop). Every Realm app configures this identically today
 * (tiffin-grab, puchkaman, xplorers `lib/auth/index.ts`) — this factory is that
 * shared config, parameterized only on the app's db handle and creation gate.
 */
export function createOrganizationPlugin(config: OrganizationPluginConfig) {
  const { db, organizationTable, eq, allowUserToCreateOrganization, additionalOrganizationFields, sendInvitationEmail } = config;
  return organizationPlugin({
    allowUserToCreateOrganization: async (user) => allowUserToCreateOrganization(user as { role?: string }),
    ...(sendInvitationEmail ? { sendInvitationEmail } : {}),
    // Every app's invite email promises 7 days; better-auth's default is 48h.
    invitationExpiresIn: 7 * 24 * 60 * 60,
    schema: {
      organization: {
        modelName: "organization",
        additionalFields: {
          clientCode: { type: "string", required: true },
          // Not settable through create/update input. Brand orgs are DB-seeded
          // (db/seed-brand-org.ts per app); franchise/shop creation is a future
          // server action that writes this server-side, not this public field.
          parentOrganizationId: { type: "string", required: false, input: false },
          region: { type: "string", required: false },
          ...additionalOrganizationFields,
        },
      },
      member: { modelName: "member" },
      invitation: { modelName: "invitation" },
    },
    organizationHooks: {
      beforeCreateOrganization: async ({ organization: newOrg }) => {
        const parentId = (newOrg as { parentOrganizationId?: string | null }).parentOrganizationId ?? null;
        if (!parentId) return;
        const [parent] = await db
          .select({ id: organizationTable.id, parentOrganizationId: organizationTable.parentOrganizationId })
          .from(organizationTable)
          .where(eq(organizationTable.id, parentId))
          .limit(1);
        try {
          assertHierarchyDepth(parent ?? null);
        } catch (e) {
          throw new APIError("BAD_REQUEST", { message: e instanceof Error ? e.message : "Invalid parent organization" });
        }
      },
    },
  });
}
