type Parse = (text: string) => unknown;

const asIs: Parse = (s) => s;
const asNumber: Parse = (s) => Number(s);
const asBool: Parse = (s) => s === "t";
const asDate: Parse = (s) => new Date(s);
const asJson: Parse = (s) => JSON.parse(s);

// Built-in array type OIDs never change, so they need no runtime pg_type lookup. Element
// parsing mirrors postgres.js's own defaults (int8 and numeric stay strings, int4 is a number,
// dates become Date), so a value reads the same as with `fetch_types` on. One deliberate
// difference: a NULL element is null here, where postgres.js gives "NULL" (text) or NaN (int).
const BUILTIN_ARRAYS: Record<string, [oid: number, element: Parse]> = {
  bool: [1000, asBool],
  int2: [1005, asNumber],
  int4: [1007, asNumber],
  text: [1009, asIs],
  varchar: [1015, asIs],
  int8: [1016, asIs],
  float4: [1021, asNumber],
  float8: [1022, asNumber],
  date: [1182, asDate],
  timestamp: [1115, asDate],
  timestamptz: [1185, asDate],
  numeric: [1231, asIs],
  uuid: [2951, asIs],
  json: [199, asJson],
  jsonb: [3807, asJson],
};

/**
 * Postgres array text form: `{a,"b c",NULL,{1,2}}`. Our own parser rather than drizzle's
 * parsePgArray, which returns an unquoted NULL as the string "NULL".
 */
export function parseArray(text: string, element: Parse): unknown[] {
  let i = 0;
  const list = (): unknown[] => {
    const out: unknown[] = [];
    i++; // "{"
    if (text[i] === "}") return i++, out;
    for (;;) {
      if (text[i] === "{") out.push(list());
      else if (text[i] === '"') {
        let s = "";
        for (i++; text[i] !== '"'; i++) s += text[i] === "\\" ? text[++i] : text[i];
        i++;
        out.push(element(s));
      } else {
        const start = i;
        while (text[i] !== "," && text[i] !== "}") i++;
        const raw = text.slice(start, i);
        out.push(raw === "NULL" ? null : element(raw));
      }
      if (text[i++] === "}") return out;
    }
  };
  return list();
}

/** postgres.js `types` entries for every built-in array type. */
export const builtinArrayTypes = Object.fromEntries(
  Object.entries(BUILTIN_ARRAYS).map(([name, [oid, element]]) => [
    `${name}_array`,
    { to: oid, from: [oid], serialize: (x: unknown) => x, parse: (s: string) => parseArray(s, element) },
  ]),
);

/**
 * Spread into every postgres.js client: `postgres(url, { ...postgresOptions, max: 5 })`.
 *
 * `fetch_types` makes each new client query pg_type for array OIDs. On Workers a client
 * lives for one request (sockets cannot cross requests), so that lookup ran on every
 * request (19% of TiffinGrab's DB time). The static `types` keep arrays parsed without it.
 * Arrays of custom types (an enum[]) are not covered and come back as text.
 *
 * @deprecated moves to `@foundry/database/pg` in A-step 2; removal on the first foundry commit on or after Part B go-live + 14 days.
 */
export const postgresOptions = { fetch_types: false, types: builtinArrayTypes } as const;
