export interface StaffInviteDeps {
  createUser: (input: { email: string; name: string; role: string }) => Promise<{ publicId: string; email: string; id: string }>;
  markPasswordUnset: (publicId: string) => Promise<void>;
  /** auth.api.inviteMember, bound by the caller to its own better-auth instance. */
  inviteMember: (input: {
    body: { email: string; role: string; organizationId: string };
  }) => Promise<{ id: string }>;
}

export class StaffInviteError extends Error {}

/**
 * Create a staff account with NO credential (createUser omits `password`, so
 * better-auth's admin plugin creates the user with no `account` row at all —
 * there is nothing to generate, hash, or leak) and a real organization
 * invitation record. The invitee proves email ownership via sign-in OTP
 * (works against a credential-less account — see the Phase 2 decision notes
 * in docs/superpowers/plans/2026-09-23-shared-organization-foundation.md)
 * then calls acceptInvitation, then sets their first password via the
 * existing /email-otp/reset-password OTP flow. Never assumes a password
 * exists at any step before that last one.
 */
export function createStaffInvite(deps: StaffInviteDeps) {
  async function inviteStaff(input: { email: string; name: string; role: string; organizationId: string }) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (name === "") throw new StaffInviteError("Name is required");

    let created: { publicId: string; email: string; id: string };
    try {
      created = await deps.createUser({ email, name, role: input.role });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/already exists/i.test(msg)) throw new StaffInviteError("That email is already in use");
      throw e;
    }

    await deps.markPasswordUnset(created.publicId);

    try {
      const invitation = await deps.inviteMember({
        body: { email: created.email, role: input.role, organizationId: input.organizationId },
      });
      return { publicId: created.publicId, email: created.email, invitationId: invitation.id };
    } catch {
      // Account is real and usable, but with no member or invitation row it
      // appears on neither Members nor Invites, so there's no in-app resend.
      // Rolling back would silently discard the created account over a
      // transient invite-send failure. Matches the current inviteUser
      // behavior in apps/*/lib/services/users-invite.ts.
      throw new StaffInviteError("Account created, but the invite email could not be sent. Contact the invitee directly, or ask them to check for an invite link, since resending isn't available for this account yet.");
    }
  }

  return { inviteStaff };
}
