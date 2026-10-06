"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type FriendRelation = "none" | "outgoing" | "incoming" | "friends";
export type FriendPerson = { publicId: string; displayUsername: string | null; name: string | null; image: string | null };
type FriendAct = "request" | "accept" | "decline" | "remove";

export type FriendsPanelProps = {
  friends: FriendPerson[];
  incoming: FriendPerson[];
  outgoing: FriendPerson[];
  /** Null when the viewer has no username yet, so there is no link to share. */
  inviteUrl: string | null;
  search: (q: string) => Promise<{ rows: (FriendPerson & { relation: FriendRelation })[]; error?: string }>;
  act: (kind: FriendAct, publicId: string) => Promise<{ error?: string }>;
  /** Each app passes its own button look (HIG, brutal, CRM); defaults to theme tokens. */
  buttonClassName?: string;
  /** Where the viewer sets a username, shown when `inviteUrl` is null. */
  accountHref?: string;
};

export function relationAction(rel: FriendRelation): { label: string; kind: FriendAct | null } {
  switch (rel) {
    case "none":
      return { label: "Add", kind: "request" };
    case "incoming":
      return { label: "Accept", kind: "accept" };
    case "outgoing":
      return { label: "Requested", kind: null };
    case "friends":
      return { label: "Friends", kind: null };
  }
}

const BTN =
  "inline-flex h-9 items-center justify-center rounded-[var(--radius)] border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";
const BTN_PRIMARY = "border-transparent bg-primary text-primary-foreground hover:bg-primary/90";
const SEARCH_DEBOUNCE_MS = 300;

function Avatar({ p }: { p: FriendPerson }) {
  const initials = (p.name ?? p.displayUsername ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt="" className="size-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
      {initials}
    </span>
  );
}

function PersonRow({ p, children }: { p: FriendPerson; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name ?? p.displayUsername ?? "Family"}</div>
        {p.displayUsername ? <div className="text-muted-foreground truncate text-sm">@{p.displayUsername}</div> : null}
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-card text-card-foreground rounded-[var(--radius)] border p-4">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function FriendsPanel({
  friends,
  incoming,
  outgoing,
  inviteUrl,
  search,
  act,
  buttonClassName,
  accountHref = "/me/account",
}: FriendsPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(FriendPerson & { relation: FriendRelation })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const seq = useRef(0);
  const btn = buttonClassName ?? BTN;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await search(term);
      if (mine !== seq.current) return;
      setResults(res.rows);
      setError(res.error ?? null);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, search]);

  const run = (kind: FriendAct, publicId: string) =>
    start(async () => {
      const res = await act(kind, publicId);
      setError(res.error ?? null);
      if (res.error) return;
      setConfirmRemove(null);
      if (kind === "request") {
        setResults((rows) => rows.map((r) => (r.publicId === publicId ? { ...r, relation: "outgoing" } : r)));
      }
      router.refresh();
    });

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    if (!inviteUrl) return;
    if (typeof navigator.share === "function") await navigator.share({ title: "Join me", url: inviteUrl }).catch(() => {});
    else await copy();
  };

  return (
    <div className="grid gap-4">
      <Section title="Invite friends">
        {inviteUrl ? (
          <div className="grid gap-2">
            <p className="text-muted-foreground text-sm">Share your link. Anyone who signs up with it becomes your friend.</p>
            <code className="bg-muted block truncate rounded px-2 py-1.5 text-sm">{inviteUrl}</code>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button type="button" className={`${btn} ${buttonClassName ? "" : BTN_PRIMARY}`} onClick={share}>
                Share
              </button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Set a username in{" "}
            <a href={accountHref} className="underline">
              Account
            </a>{" "}
            to get your invite link.
          </p>
        )}
      </Section>

      <Section title="Find friends">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or name"
          aria-label="Search friends"
          className="border-border bg-background h-10 w-full rounded-[var(--radius)] border px-3 text-base"
        />
        {error ? (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {error}
          </p>
        ) : null}
        {q.trim().length >= 2 ? (
          results.length > 0 ? (
            <ul className="divide-border mt-2 divide-y">
              {results.map((r) => {
                const a = relationAction(r.relation);
                return (
                  <PersonRow key={r.publicId} p={r}>
                    <button
                      type="button"
                      className={`${btn} ${a.kind && !buttonClassName ? BTN_PRIMARY : ""}`}
                      disabled={!a.kind || pending}
                      onClick={() => a.kind && run(a.kind, r.publicId)}
                    >
                      {a.label}
                    </button>
                  </PersonRow>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">No one found.</p>
          )
        ) : null}
      </Section>

      {incoming.length > 0 || outgoing.length > 0 ? (
        <Section title="Requests">
          <ul className="divide-border divide-y">
            {incoming.map((p) => (
              <PersonRow key={p.publicId} p={p}>
                <button type="button" className={`${btn} ${buttonClassName ? "" : BTN_PRIMARY}`} disabled={pending} onClick={() => run("accept", p.publicId)}>
                  Accept
                </button>
                <button type="button" className={btn} disabled={pending} onClick={() => run("decline", p.publicId)}>
                  Decline
                </button>
              </PersonRow>
            ))}
            {outgoing.map((p) => (
              <PersonRow key={p.publicId} p={p}>
                <button type="button" className={btn} disabled={pending} onClick={() => run("remove", p.publicId)}>
                  Cancel request
                </button>
              </PersonRow>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={`Friends${friends.length ? ` (${friends.length})` : ""}`}>
        {friends.length === 0 ? (
          <p className="text-muted-foreground text-sm">No friends yet. Search above or share your invite link.</p>
        ) : (
          <ul className="divide-border divide-y">
            {friends.map((p) => (
              <PersonRow key={p.publicId} p={p}>
                {confirmRemove === p.publicId ? (
                  <>
                    <button type="button" className={btn} disabled={pending} onClick={() => run("remove", p.publicId)}>
                      Yes, remove
                    </button>
                    <button type="button" className={btn} onClick={() => setConfirmRemove(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button" className={btn} onClick={() => setConfirmRemove(p.publicId)}>
                    Remove
                  </button>
                )}
              </PersonRow>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
