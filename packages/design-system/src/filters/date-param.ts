import { dayRange, isRealDate } from "@foundry/commons/util/dates";

const MAX_MS = 8.64e15;

/** A `from`/`to` URL value as epoch ms: raw epoch digits, or an ISO day read in `timeZone` (default: the runtime's). Anything else is undefined. */
export function dateParamMs(raw: string | null | undefined, edge: "from" | "to", timeZone?: string): number | undefined {
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isSafeInteger(n) && n <= MAX_MS ? n : undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isRealDate(raw)) return undefined;
  const { start, end } = dayRange(raw, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  return edge === "from" ? start : end - 1;
}

/** Both ends, swapped when reversed (ISO days compare as the same order as their ms). */
export function dateParamRange(
  from: string | null | undefined,
  to: string | null | undefined,
  timeZone?: string,
): { from?: number; to?: number } {
  const bothIso = from && to && /^\d{4}-/.test(from) && /^\d{4}-/.test(to) && from > to;
  const a = dateParamMs(bothIso ? to : from, "from", timeZone);
  const b = dateParamMs(bothIso ? from : to, "to", timeZone);
  if (a != null && b != null) return { from: Math.min(a, b), to: Math.max(a, b) };
  return { ...(a != null && { from: a }), ...(b != null && { to: b }) };
}
