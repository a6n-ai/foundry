import { ForbiddenError } from "@foundry/commons";
import { describe, expect, it, vi } from "vitest";
import { createAccessControl, createOrgStatement } from "../access";
import { accessAllows, createOrgPermissionGuards, resolveOrgAccess } from "../org-permissions";

const ac = createAccessControl(createOrgStatement({ order: ["read", "cancel"], menu: ["read", "write"] }));
const roles = { admin: ac.newRole({ order: ["read", "cancel"] }) };
const base = { platformRole: null, userId: "u1", organizationId: "o1", customRoles: {}, roles, ac };

describe("org permissions", () => {
  it("super_admin -> platform, allows anything, calls onPlatformBypass once per allowed check", async () => {
    const access = resolveOrgAccess({ ...base, platformRole: "super_admin", organizationId: null, memberRole: null });
    expect(access).toEqual({ kind: "platform", userId: "u1" });
    const onPlatformBypass = vi.fn(async () => {});
    const g = createOrgPermissionGuards({ getAccess: async () => access, onPlatformBypass });
    expect(await g.can({ menu: ["write"] })).toBe(true);
    await g.requirePermission({ order: ["cancel"] });
    expect(onPlatformBypass).toHaveBeenCalledTimes(2);
    expect(onPlatformBypass).toHaveBeenCalledWith("u1", { order: ["cancel"] });
  });

  it('member "admin,kitchen" -> union: allows kitchen-only menu:write and admin-only order:cancel', () => {
    const access = resolveOrgAccess({ ...base, memberRole: " admin , kitchen", customRoles: { kitchen: { menu: ["write"] } } });
    expect(accessAllows(access, { menu: ["write"] })).toBe(true);
    expect(accessAllows(access, { order: ["cancel"] })).toBe(true);
    expect(accessAllows(access, { menu: ["write"], order: ["cancel"] })).toBe(false);
    expect(accessAllows(access, { organization: ["delete"] })).toBe(false);
  });

  it("unknown role name -> member with roles [] -> denies everything", () => {
    const access = resolveOrgAccess({ ...base, memberRole: "ghost" });
    expect(access).toMatchObject({ kind: "member", roles: [] });
    expect(accessAllows(access, { order: ["read"] })).toBe(false);
  });

  it("no organizationId -> none -> requirePermission throws ForbiddenError", async () => {
    const access = resolveOrgAccess({ ...base, organizationId: null, memberRole: "admin" });
    expect(access).toEqual({ kind: "none" });
    const g = createOrgPermissionGuards({ getAccess: async () => access });
    await expect(g.requirePermission({ order: ["read"] })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await g.can({ order: ["read"] })).toBe(false);
  });

  it("custom role permission JSON -> allows exactly its actions", () => {
    const access = resolveOrgAccess({ ...base, memberRole: "cook", customRoles: { cook: { menu: ["read"] }, admin: { menu: ["write"] } } });
    expect(accessAllows(access, { menu: ["read"] })).toBe(true);
    expect(accessAllows(access, { menu: ["write"] })).toBe(false);
    const builtinWins = resolveOrgAccess({ ...base, memberRole: "admin", customRoles: { admin: { menu: ["write"] } } });
    expect(accessAllows(builtinWins, { menu: ["write"] })).toBe(false);
  });
});
