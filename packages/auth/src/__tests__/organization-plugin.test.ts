import { describe, expect, it, vi } from "vitest";
import { createOrganizationPlugin } from "../organization-plugin";

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
