import { describe, expect, it } from "vitest";
import { isGrantable, togglePermission } from "../org-roles/permission-map";
import { validateRoleName } from "../org-roles/org-role-dialog";

const grantable = { order: ["read", "update"], member: ["read"] };

describe("togglePermission", () => {
  it("adds then removes an action, dropping empty resource keys", () => {
    const added = togglePermission({}, "order", "read", grantable);
    expect(added).toEqual({ order: ["read"] });
    expect(togglePermission(added, "order", "read", grantable)).toEqual({});
  });

  it("returns the value unchanged for a non-grantable action", () => {
    const value = { order: ["read"] };
    expect(togglePermission(value, "member", "delete", grantable)).toBe(value);
    expect(isGrantable(grantable, "member", "delete")).toBe(false);
    expect(isGrantable(grantable, "order", "update")).toBe(true);
  });
});

describe("validateRoleName", () => {
  it("accepts lowercase, digits, hyphens; rejects commas, spaces, caps", () => {
    expect(validateRoleName("kitchen-2")).toBeUndefined();
    for (const bad of ["a,b", "a b", "Kitchen", ""]) expect(validateRoleName(bad)).toBeTruthy();
  });
});
