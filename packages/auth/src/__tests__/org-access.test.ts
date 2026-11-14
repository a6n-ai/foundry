import { describe, expect, it } from "vitest";
import { createAccessControl, createOrgRoles, createOrgStatement } from "../access";

const app = { order: ["read", "write"], menu: ["read"] } as const;
const statement = createOrgStatement(app);
const ac = createAccessControl(statement);
const r = createOrgRoles(ac, app, { order: ["read"] });

describe("org access statement and roles", () => {
  it("owner can delete org and manage roles", () => {
    expect(r.owner.authorize({ organization: ["delete"], ac: ["create"] }).success).toBe(true);
  });

  it("admin gets every app action but not organization:delete", () => {
    expect(r.admin.authorize({ order: ["write"], menu: ["read"] }).success).toBe(true);
    expect(r.admin.authorize({ organization: ["delete"] }).success).toBe(false);
  });

  it("member gets only the listed app permissions", () => {
    expect(r.member.authorize({ order: ["read"] }).success).toBe(true);
    expect(r.member.authorize({ order: ["write"] }).success).toBe(false);
  });

  it("statement keeps admin-plugin user/session resources", () => {
    expect(statement.user).toContain("create");
  });
});
