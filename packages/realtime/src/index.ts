export type Channel = string; // e.g. `ticket:tkt_abc`

const REALTIME_ROLES = ["staff", "customer"] as const;

// Role of the emitting user, so the peer can decide relevance ("is the OTHER
// side online / typing"). "staff" covers admin+member; "customer" is a user.
export type RealtimeRole = (typeof REALTIME_ROLES)[number];

type FieldTypes = { string: string; boolean: boolean; role: RealtimeRole };

// The one list of events: `RealtimeEvent` and `isRealtimeEvent` both derive from it,
// so an event cannot be added without the Worker `/publish` accepting it.
const EVENT_FIELDS = {
  presence: { userId: "string", role: "role", online: "boolean" },
  typing: { userId: "string", role: "role", typing: "boolean" },
  message: { channel: "string" }, // live "something new" ping → peer refreshes
} as const satisfies Record<string, Record<string, keyof FieldTypes>>;

type EventFields = typeof EVENT_FIELDS;

export type RealtimeEvent = {
  [T in keyof EventFields]: { type: T } & { [F in keyof EventFields[T]]: EventFields[T][F] extends keyof FieldTypes ? FieldTypes[EventFields[T][F]] : never };
}[keyof EventFields];

const FIELD_CHECKS: Record<keyof FieldTypes, (v: unknown) => boolean> = {
  string: (v) => typeof v === "string",
  boolean: (v) => typeof v === "boolean",
  role: (v) => REALTIME_ROLES.includes(v as RealtimeRole),
};

export function isRealtimeEvent(e: unknown): e is RealtimeEvent {
  if (!e || typeof e !== "object") return false;
  const v = e as Record<string, unknown>;
  if (typeof v.type !== "string" || !Object.hasOwn(EVENT_FIELDS, v.type)) return false;
  const fields = EVENT_FIELDS[v.type as keyof EventFields] as Record<string, keyof FieldTypes>;
  return Object.entries(fields).every(([name, kind]) => FIELD_CHECKS[kind](v[name]));
}

export { signRealtimeToken, verifyRealtimeToken, type RealtimeTokenPayload } from "./token";
