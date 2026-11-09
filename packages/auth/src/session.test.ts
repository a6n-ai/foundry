import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.hoisted(() => vi.fn(async () => new Headers()));
vi.mock("next/headers", () => ({ headers: headersMock }));

import { createGetSession, isDynamicServerError } from "./session";

const make = (getSession: () => Promise<unknown>) => createGetSession({ auth: { api: { getSession } } });

beforeEach(() => headersMock.mockImplementation(async () => new Headers()));

describe("createGetSession", () => {
  it("exposes publicId as the id, defaults the role, and carries the active org", async () => {
    const getSession = make(async () => ({
      user: { id: "1", publicId: "usr_a", email: "a@x.test" },
      session: { activeOrganizationId: "org_1" },
    }));
    expect(await getSession()).toEqual({
      user: { id: "usr_a", role: "user", email: "a@x.test", platformRole: null },
      session: { activeOrganizationId: "org_1" },
    });
  });

  it("fails closed when publicId is missing, and on no user", async () => {
    expect(await make(async () => ({ user: { id: "1" } }))()).toBeNull();
    expect(await make(async () => null)()).toBeNull();
  });

  it("treats a generic throw as unauthenticated but lets Next's dynamic-usage error through", async () => {
    expect(await make(async () => { throw new Error("no request"); })()).toBeNull();
    const dyn = Object.assign(new Error("dyn"), { digest: "DYNAMIC_SERVER_USAGE" });
    await expect(make(async () => { throw dyn; })()).rejects.toBe(dyn);
  });
});

describe("isDynamicServerError", () => {
  it("matches the digest only", () => {
    expect(isDynamicServerError({ digest: "DYNAMIC_SERVER_USAGE:x" })).toBe(true);
    expect(isDynamicServerError(new Error("x"))).toBe(false);
  });
});
