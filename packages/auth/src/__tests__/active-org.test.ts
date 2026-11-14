import { describe, expect, it, vi } from "vitest";
import { ensureActiveOrganization } from "../active-org";

const headers = new Headers();

function fakeApi(opts: { session: { activeOrganizationId?: string | null; user?: { id: string } } | null; orgs?: { id: string }[] }) {
  return {
    getSession: vi.fn(async () => (opts.session ? { session: { activeOrganizationId: null, ...opts.session }, user: { id: "u1" } } : null)),
    listOrganizations: vi.fn(async () => opts.orgs ?? []),
    setActiveOrganization: vi.fn(async () => ({})),
  };
}

describe("ensureActiveOrganization", () => {
  it("keeps an already-active org without calling setActiveOrganization", async () => {
    const api = fakeApi({ session: { activeOrganizationId: "o2", user: { id: "u1" } }, orgs: [{ id: "o1" }, { id: "o2" }] });
    expect(await ensureActiveOrganization(api, headers)).toBe("o2");
    expect(api.setActiveOrganization).not.toHaveBeenCalled();
  });

  it("activates the first membership when none is set", async () => {
    const api = fakeApi({ session: { activeOrganizationId: null, user: { id: "u1" } }, orgs: [{ id: "o1" }, { id: "o2" }] });
    expect(await ensureActiveOrganization(api, headers)).toBe("o1");
    expect(api.setActiveOrganization).toHaveBeenCalledWith({ headers, body: { organizationId: "o1" } });
  });

  it("returns null when the user has no memberships", async () => {
    const api = fakeApi({ session: { activeOrganizationId: null, user: { id: "u1" } }, orgs: [] });
    expect(await ensureActiveOrganization(api, headers)).toBeNull();
    expect(api.setActiveOrganization).not.toHaveBeenCalled();
  });

  it("returns null without a session", async () => {
    const api = fakeApi({ session: null });
    expect(await ensureActiveOrganization(api, headers)).toBeNull();
    expect(api.listOrganizations).not.toHaveBeenCalled();
    expect(api.setActiveOrganization).not.toHaveBeenCalled();
  });
});
