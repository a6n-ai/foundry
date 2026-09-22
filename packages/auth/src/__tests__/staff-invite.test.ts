import { describe, expect, it, vi } from "vitest";
import { createStaffInvite, StaffInviteError } from "../staff-invite";

describe("createStaffInvite", () => {
  it("creates a credential-less user then a real invitation", async () => {
    const createUser = vi.fn().mockResolvedValue({ publicId: "pub_1", email: "a@x.com", id: "u_1" });
    const markPasswordUnset = vi.fn().mockResolvedValue(undefined);
    const inviteMember = vi.fn().mockResolvedValue({ id: "inv_1" });
    const { inviteStaff } = createStaffInvite({ createUser, markPasswordUnset, inviteMember });

    const result = await inviteStaff({ email: "A@X.com", name: "A", role: "admin", organizationId: "org_1" });

    expect(createUser).toHaveBeenCalledWith({ email: "a@x.com", name: "A", role: "admin" });
    expect(markPasswordUnset).toHaveBeenCalledWith("pub_1");
    expect(inviteMember).toHaveBeenCalledWith({ body: { email: "a@x.com", role: "admin", organizationId: "org_1" } });
    expect(result).toEqual({ publicId: "pub_1", email: "a@x.com", invitationId: "inv_1" });
  });

  it("rejects blank name before calling createUser", async () => {
    const createUser = vi.fn();
    const { inviteStaff } = createStaffInvite({
      createUser,
      markPasswordUnset: vi.fn(),
      inviteMember: vi.fn(),
    });
    await expect(inviteStaff({ email: "a@x.com", name: "  ", role: "admin", organizationId: "org_1" })).rejects.toThrow(StaffInviteError);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("surfaces a retryable error when invite send fails, without rolling back the account", async () => {
    const createUser = vi.fn().mockResolvedValue({ publicId: "pub_1", email: "a@x.com", id: "u_1" });
    const markPasswordUnset = vi.fn().mockResolvedValue(undefined);
    const inviteMember = vi.fn().mockRejectedValue(new Error("SES down"));
    const { inviteStaff } = createStaffInvite({ createUser, markPasswordUnset, inviteMember });

    await expect(inviteStaff({ email: "a@x.com", name: "A", role: "admin", organizationId: "org_1" })).rejects.toThrow(/could not be sent/);
    expect(markPasswordUnset).toHaveBeenCalled(); // account stands, only the invite send failed
  });
});
