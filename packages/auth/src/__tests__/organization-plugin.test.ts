import { describe, expect, it, vi } from "vitest";
import { createOrganizationPlugin } from "../organization-plugin";
import { createAccessControl, createOrgRoles, createOrgStatement } from "../access";

const minimal = {
  db: { select: vi.fn() },
  organizationTable: { id: {}, parentOrganizationId: {} },
  eq: () => ({}),
  allowUserToCreateOrganization: () => true,
};

const app = { order: ["read", "write"] } as const;
const statement = createOrgStatement(app);
const ac = createAccessControl(statement);
const roles = createOrgRoles(ac, app, { order: ["read"] });

describe("createOrganizationPlugin access control passthrough", () => {
  it("forwards ac, roles and dynamicAccessControl to better-auth", () => {
    const plugin = createOrganizationPlugin({
      ...minimal,
      ac,
      roles,
      dynamicAccessControl: { enabled: true, maximumRolesPerOrganization: 20 },
    });
    expect(plugin.options.ac).toBe(ac);
    expect(plugin.options.roles).toBe(roles);
    expect(plugin.options.dynamicAccessControl?.enabled).toBe(true);
    expect(plugin.options.schema?.organizationRole).toEqual({ modelName: "organizationRole" });
  });

  it("leaves access control unset when the app passes nothing", () => {
    const plugin = createOrganizationPlugin(minimal);
    expect(plugin.options.ac).toBeUndefined();
    expect(plugin.options.roles).toBeUndefined();
    expect(plugin.options.dynamicAccessControl).toBeUndefined();
    expect(plugin.options.schema?.organizationRole).toBeUndefined();
  });
});

describe("createOrganizationPlugin", () => {
  it("rejects creating a child under a parent that already has a parent", async () => {
    const parentRow = { id: "shop-1", parentOrganizationId: "brand-1" };
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [parentRow] }),
        }),
      }),
    };
    const plugin = createOrganizationPlugin({
      db,
      organizationTable: { id: "id", parentOrganizationId: "parentOrganizationId" },
      eq: (a, b) => [a, b],
      allowUserToCreateOrganization: () => true,
    });
    const hook = plugin.options.organizationHooks.beforeCreateOrganization;
    await expect(
      hook({ organization: { parentOrganizationId: "shop-1" } } as never),
    ).rejects.toThrow(/capped at 2 levels/);
  });

  it("allows creating a top-level org (no parentOrganizationId)", async () => {
    const db = { select: vi.fn() };
    const plugin = createOrganizationPlugin({
      db,
      organizationTable: { id: "id", parentOrganizationId: "parentOrganizationId" },
      eq: (a, b) => [a, b],
      allowUserToCreateOrganization: () => true,
    });
    const hook = plugin.options.organizationHooks.beforeCreateOrganization;
    await expect(hook({ organization: { parentOrganizationId: null } } as never)).resolves.toBeUndefined();
    expect(db.select).not.toHaveBeenCalled();
  });
});
