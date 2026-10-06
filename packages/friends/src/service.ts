import { and, asc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { NotFoundError, ValidationError } from "@foundry/commons";
import type { Database } from "@foundry/database";
import type { makeFriendTables } from "./schema";
import { normalizeUsername, suggestUsername } from "./username";

export type Relation = "none" | "outgoing" | "incoming" | "friends";
export type FriendPerson = {
  publicId: string;
  displayUsername: string | null;
  name: string | null;
  image: string | null;
};
export type FriendSearchRow = FriendPerson & { relation: Relation };
export type FriendLists = { friends: FriendPerson[]; incoming: FriendPerson[]; outgoing: FriendPerson[] };

/** The app `users` columns the service reads. Customers are role `user`. */
export type FriendUsersTable = AnyPgTable & {
  id: AnyPgColumn;
  publicId: AnyPgColumn;
  name: AnyPgColumn;
  image: AnyPgColumn;
  role: AnyPgColumn;
  status: AnyPgColumn;
  username: AnyPgColumn;
  displayUsername: AnyPgColumn;
};
type FriendshipsTable = ReturnType<typeof makeFriendTables>["friendships"];

type PairRow = { requesterId: bigint; addresseeId: bigint; status: string };

export function relationOf(viewerId: bigint, row: PairRow | undefined): Relation {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === viewerId ? "outgoing" : "incoming";
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const SEARCH_LIMIT = 20;
const ENSURE_TRIES = 5;

/**
 * Friends between customers of one app. Every method takes user `publicId`s
 * (what the session carries) and resolves internal ids itself. Only active
 * customers can be found, asked or invited; staff are "not found".
 */
export function createFriendsService(deps: { db: Database; users: FriendUsersTable; friendships: FriendshipsTable }) {
  const { db, users, friendships: f } = deps;

  const person = {
    id: users.id,
    publicId: users.publicId,
    displayUsername: sql<string | null>`coalesce(${users.displayUsername}, ${users.username})`,
    name: users.name,
    image: users.image,
  };
  const isCustomer = and(eq(users.role, "user"), eq(users.status, "active"));

  const pairWhere = (a: bigint, b: bigint): SQL =>
    or(and(eq(f.requesterId, a), eq(f.addresseeId, b)), and(eq(f.requesterId, b), eq(f.addresseeId, a)))!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function customer(publicId: string, q: any = db): Promise<{ id: bigint } & FriendPerson> {
    const [row] = await q.select(person).from(users).where(and(eq(users.publicId, publicId), isCustomer)).limit(1);
    if (!row) throw new NotFoundError("We couldn't find that family");
    return row as { id: bigint } & FriendPerson;
  }

  const strip = ({ id: _id, ...p }: { id: bigint } & FriendPerson): FriendPerson => p;

  async function search(viewerPublicId: string, q: string): Promise<FriendSearchRow[]> {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) return [];
    const me = await customer(viewerPublicId);
    const pattern = escapeLike(term);
    const rows = (await db
      .select(person)
      .from(users)
      .where(
        and(
          isCustomer,
          ne(users.id, me.id),
          or(sql`${users.username} like ${`${pattern.toLowerCase()}%`}`, sql`${users.name} ilike ${`%${pattern}%`}`),
        ),
      )
      .orderBy(sql`${users.username} asc nulls last`, asc(users.id))
      .limit(SEARCH_LIMIT)) as ({ id: bigint } & FriendPerson)[];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const pairs = (await db
      .select({ requesterId: f.requesterId, addresseeId: f.addresseeId, status: f.status })
      .from(f)
      .where(
        or(
          and(eq(f.requesterId, me.id), inArray(f.addresseeId, ids)),
          and(eq(f.addresseeId, me.id), inArray(f.requesterId, ids)),
        ),
      )) as PairRow[];
    return rows.map((r) => ({
      ...strip(r),
      relation: relationOf(
        me.id,
        pairs.find((p) => p.requesterId === r.id || p.addresseeId === r.id),
      ),
    }));
  }

  async function requestOnce(viewerPublicId: string, targetPublicId: string): Promise<Relation> {
    return db.transaction(async (tx) => {
      const me = await customer(viewerPublicId, tx);
      const them = await customer(targetPublicId, tx);
      if (me.id === them.id) throw new ValidationError("You can't add yourself");
      const [row] = (await tx
        .select({ id: f.id, requesterId: f.requesterId, addresseeId: f.addresseeId, status: f.status })
        .from(f)
        .where(pairWhere(me.id, them.id))
        .for("update")) as (PairRow & { id: bigint })[];
      if (row?.status === "pending" && row.addresseeId === me.id) {
        await tx.update(f).set({ status: "accepted", acceptedAt: Date.now() }).where(eq(f.id, row.id));
        return "friends";
      }
      if (row) return relationOf(me.id, row);
      await tx.insert(f).values({ requesterId: me.id, addresseeId: them.id, createdBy: me.id });
      return "outgoing";
    });
  }

  /**
   * Ask to be friends. If they already asked you, this accepts. Two people
   * asking each other at once: one insert loses on the pair index, and the
   * retry finds the other's request and accepts it.
   */
  async function request(viewerPublicId: string, targetPublicId: string): Promise<Relation> {
    try {
      return await requestOnce(viewerPublicId, targetPublicId);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      return requestOnce(viewerPublicId, targetPublicId);
    }
  }

  async function accept(viewerPublicId: string, requesterPublicId: string): Promise<void> {
    const [me, them] = await Promise.all([customer(viewerPublicId), customer(requesterPublicId)]);
    await db
      .update(f)
      .set({ status: "accepted", acceptedAt: Date.now() })
      .where(and(eq(f.requesterId, them.id), eq(f.addresseeId, me.id), eq(f.status, "pending")));
  }

  async function decline(viewerPublicId: string, requesterPublicId: string): Promise<void> {
    const [me, them] = await Promise.all([customer(viewerPublicId), customer(requesterPublicId)]);
    await db.delete(f).where(and(eq(f.requesterId, them.id), eq(f.addresseeId, me.id), eq(f.status, "pending")));
  }

  /** Unfriend, or cancel my own pending request. */
  async function remove(viewerPublicId: string, otherPublicId: string): Promise<void> {
    const me = await customer(viewerPublicId);
    const [them] = await db.select({ id: users.id }).from(users).where(eq(users.publicId, otherPublicId)).limit(1);
    if (!them) return;
    await db.delete(f).where(pairWhere(me.id, them.id as bigint));
  }

  async function list(viewerPublicId: string): Promise<FriendLists> {
    const me = await customer(viewerPublicId);
    const other = sql`case when ${f.requesterId} = ${me.id} then ${f.addresseeId} else ${f.requesterId} end`;
    const rows = (await db
      .select({ ...person, requesterId: f.requesterId, addresseeId: f.addresseeId, status: f.status })
      .from(f)
      .innerJoin(users, eq(users.id, other))
      .where(and(or(eq(f.requesterId, me.id), eq(f.addresseeId, me.id)), ne(users.status, "deleted")))
      .orderBy(sql`coalesce(${users.displayUsername}, ${users.username}, ${users.name}) asc`)) as ({
      id: bigint;
    } & FriendPerson &
      PairRow)[];
    const out: FriendLists = { friends: [], incoming: [], outgoing: [] };
    for (const r of rows) {
      const { requesterId, addresseeId, status, ...p } = r;
      const rel = relationOf(me.id, { requesterId, addresseeId, status });
      const bucket = rel === "friends" ? out.friends : rel === "incoming" ? out.incoming : out.outgoing;
      bucket.push(strip(p));
    }
    return out;
  }

  /**
   * Invite link: the viewer becomes friends with whoever shared it. Unknown,
   * malformed, staff and own usernames are ignored (returns false).
   */
  async function acceptInvite(viewerPublicId: string, refUsername: string): Promise<boolean> {
    let ref: string;
    try {
      ref = normalizeUsername(refUsername).username;
    } catch {
      return false;
    }
    const me = await customer(viewerPublicId);
    const [inviter] = (await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, ref), isCustomer))
      .limit(1)) as { id: bigint }[];
    if (!inviter || inviter.id === me.id) return false;
    await db
      .insert(f)
      .values({ requesterId: inviter.id, addresseeId: me.id, status: "accepted", acceptedAt: Date.now(), createdBy: me.id })
      .onConflictDoNothing();
    // A pending request either way already held the pair: the link settles it.
    await db
      .update(f)
      .set({ status: "accepted", acceptedAt: Date.now() })
      .where(and(pairWhere(me.id, inviter.id), eq(f.status, "pending")));
    return true;
  }

  /** Give a customer a username if they have none. Returns the username, or null after repeated clashes. */
  async function ensureUsername(userPublicId: string): Promise<string | null> {
    const [u] = (await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(eq(users.publicId, userPublicId))
      .limit(1)) as { id: bigint; name: string | null; username: string | null }[];
    if (!u) return null;
    if (u.username) return u.username;
    for (let i = 0; i < ENSURE_TRIES; i++) {
      const candidate = suggestUsername(u.name);
      try {
        const done = await db
          .update(users)
          .set({ username: candidate, displayUsername: candidate } as never)
          .where(and(eq(users.id, u.id), isNull(users.username)))
          .returning({ username: users.username });
        if (done.length > 0) return candidate;
        // Someone else set it between our read and write: keep theirs.
        const [now] = (await db.select({ username: users.username }).from(users).where(eq(users.id, u.id))) as {
          username: string | null;
        }[];
        return now?.username ?? null;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    return null;
  }

  /** Set or clear the viewer's username. Taken (in any casing) is a ValidationError. */
  async function setUsername(userPublicId: string, raw: string | null): Promise<void> {
    const value = (raw ?? "").trim();
    const patch = value ? normalizeUsername(value) : { username: null, displayUsername: null };
    try {
      await db.update(users).set(patch as never).where(eq(users.publicId, userPublicId));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ValidationError("That username is already taken");
      throw e;
    }
  }

  return { search, request, accept, decline, remove, list, acceptInvite, ensureUsername, setUsername };
}

export type FriendsService = ReturnType<typeof createFriendsService>;
