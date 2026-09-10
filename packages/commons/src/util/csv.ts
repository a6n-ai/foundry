export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Minimal RFC-4180 reader. A dedicated parser would be a runtime dependency on
 * a package that otherwise has none; quoted fields, escaped quotes and embedded
 * newlines are the only cases a contact export actually produces.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      endField();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  endRow();

  const [headers = [], ...body] = rows;
  return { headers, rows: body };
}

// Loose normalization for dedup/matching keys (CSV import, suppression lists):
// lowercase an email, or strip an address down to digits with a leading plus
// if it had one. Not validation — pair with a real schema (e.g. phoneSchema)
// at any trust boundary that needs to reject malformed input.
export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const digits = trimmed.replace(/[^\d]/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export interface ContactMapping {
  email?: string;
  phone?: string;
  name?: string;
}

export interface ParsedContact {
  email?: string;
  phone?: string;
  name: string;
  vars: Record<string, string>;
}

// Deliberately loose: rejecting deliverable-but-unusual addresses costs a real
// customer, and a bounce is the authoritative answer anyway. Exported so a
// preview UI can re-check an admin's inline fix with the exact same rule
// mapRows used to reject it.
export function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1 && !value.includes(" ");
}

/**
 * Apply an admin's column mapping to parsed CSV rows: name is mandatory (it's
 * the only human-readable identifier the row carries), and one of email/phone
 * must be present. Unmapped columns become merge vars, so a template can use
 * `{{contact.City}}` without the schema knowing about cities.
 */
export interface RejectedRow {
  row: number;
  reason: string;
  /** Raw (unvalidated, unnormalized) field values — so a preview UI can show
   * and edit the row that was rejected, not just report that one was. */
  name: string;
  email: string;
  phone: string;
  vars: Record<string, string>;
}

export function mapRows(
  parsed: ParsedCsv,
  mapping: ContactMapping,
): { valid: ParsedContact[]; rejected: RejectedRow[] } {
  const idx = (header?: string) => (header ? parsed.headers.indexOf(header) : -1);
  const iEmail = idx(mapping.email);
  const iPhone = idx(mapping.phone);
  const iName = idx(mapping.name);
  const mapped = new Set([iEmail, iPhone, iName].filter((n) => n >= 0));

  const valid: ParsedContact[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();

  const rawVars = (cells: string[]): Record<string, string> => {
    const vars: Record<string, string> = {};
    parsed.headers.forEach((h, c) => {
      if (mapped.has(c)) return;
      const v = (cells[c] ?? "").trim();
      if (v) vars[h] = v;
    });
    return vars;
  };

  parsed.rows.forEach((cells, n) => {
    const rawEmail = iEmail >= 0 ? (cells[iEmail] ?? "").trim() : "";
    const rawPhone = iPhone >= 0 ? (cells[iPhone] ?? "").trim() : "";
    const rawName = iName >= 0 ? (cells[iName] ?? "").trim() : "";
    if (!rawName) {
      rejected.push({ row: n + 1, reason: "missing name", name: rawName, email: rawEmail, phone: rawPhone, vars: rawVars(cells) });
      return;
    }
    if (!rawEmail && !rawPhone) {
      rejected.push({ row: n + 1, reason: "no email or phone", name: rawName, email: rawEmail, phone: rawPhone, vars: rawVars(cells) });
      return;
    }
    if (rawEmail && !looksLikeEmail(rawEmail)) {
      rejected.push({ row: n + 1, reason: "invalid email", name: rawName, email: rawEmail, phone: rawPhone, vars: rawVars(cells) });
      return;
    }

    const email = rawEmail ? normalizeAddress(rawEmail) : undefined;
    const phone = rawPhone ? normalizeAddress(rawPhone) : undefined;
    const key = email ?? phone!;
    if (seen.has(key)) {
      rejected.push({ row: n + 1, reason: "duplicate in file", name: rawName, email: rawEmail, phone: rawPhone, vars: rawVars(cells) });
      return;
    }
    seen.add(key);

    valid.push({ email, phone, name: rawName, vars: rawVars(cells) });
  });

  return { valid, rejected };
}
