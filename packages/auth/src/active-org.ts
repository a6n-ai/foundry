type ActiveOrgApi = {
  getSession(ctx: { headers: Headers }): Promise<{
    session: { activeOrganizationId?: string | null };
    user: unknown;
  } | null>;
  listOrganizations(ctx: { headers: Headers }): Promise<{ id: string }[]>;
  setActiveOrganization(ctx: { headers: Headers; body: { organizationId: string } }): Promise<unknown>;
};

/**
 * Dashboards call this on load: sessions created before org memberships had
 * an active org carry activeOrganizationId = null. Returns the active org id
 * after the call, or null when the user has no session or no memberships.
 */
export async function ensureActiveOrganization(api: ActiveOrgApi, headers: Headers): Promise<string | null> {
  const session = await api.getSession({ headers });
  if (!session?.user) return null;
  if (session.session.activeOrganizationId) return session.session.activeOrganizationId;

  const orgs = await api.listOrganizations({ headers });
  const first = orgs[0];
  if (!first?.id) return null;

  await api.setActiveOrganization({ headers, body: { organizationId: first.id } });
  return first.id;
}
