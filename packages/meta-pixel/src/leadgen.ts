import { createHmac, timingSafeEqual } from "node:crypto";
import { createLogger } from "@foundry/commons/logger";
import { META_GRAPH_API_VERSION } from "./capi";

const log = createLogger("meta-leadgen");

/** Meta Lead Ads id: 15–17 digits. */
export const META_LEAD_ID_RE = /^\d{15,17}$/;

export function normalizeMetaLeadId(raw: string | number | null | undefined): string | null {
  const s = raw == null ? "" : String(raw).trim();
  return META_LEAD_ID_RE.test(s) ? s : null;
}

/**
 * Verify Meta webhook GET challenge.
 * Returns the challenge string to echo, or null when the verify token does not match.
 */
export function verifyLeadgenChallenge(input: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
  expectedVerifyToken: string;
}): string | null {
  if (input.mode !== "subscribe") return null;
  if (!input.challenge?.trim()) return null;
  if (!input.expectedVerifyToken || input.verifyToken !== input.expectedVerifyToken) return null;
  return input.challenge;
}

/**
 * Validate `X-Hub-Signature-256: sha256=<hex>` when an app secret is configured.
 * Returns true when no secret is configured (caller may still require one).
 */
export function verifyLeadgenSignature(rawBody: string, signatureHeader: string | null, appSecret: string | null): boolean {
  if (!appSecret) return true;
  const expected = signatureHeader?.trim() ?? "";
  const prefix = "sha256=";
  if (!expected.startsWith(prefix)) return false;
  const their = expected.slice(prefix.length);
  const ours = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(their, "hex");
    const b = Buffer.from(ours, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type MetaLeadgenWebhookEntry = {
  leadgenId: string;
  pageId?: string;
  formId?: string;
  createdTime?: number;
};

type LeadgenChangeValue = {
  leadgen_id?: string | number;
  page_id?: string | number;
  form_id?: string | number;
  created_time?: number;
};

/** Parse leadgen_ids out of a Meta webhook POST body. */
export function parseLeadgenWebhook(body: unknown): MetaLeadgenWebhookEntry[] {
  const root = body as { object?: string; entry?: unknown } | null;
  if (!root || root.object !== "page" || !Array.isArray(root.entry)) return [];
  const out: MetaLeadgenWebhookEntry[] = [];
  for (const entry of root.entry) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const c = change as { field?: string; value?: LeadgenChangeValue };
      if (c.field !== "leadgen") continue;
      const leadgenId = normalizeMetaLeadId(c.value?.leadgen_id);
      if (!leadgenId) continue;
      out.push({
        leadgenId,
        pageId: c.value?.page_id != null ? String(c.value.page_id) : undefined,
        formId: c.value?.form_id != null ? String(c.value.form_id) : undefined,
        createdTime: typeof c.value?.created_time === "number" ? c.value.created_time : undefined,
      });
    }
  }
  return out;
}

export type FetchedMetaLead = {
  leadId: string;
  createdTime?: number;
  fieldData: Record<string, string>;
  email?: string;
  phone?: string;
  fullName?: string;
};

function fieldMap(fieldData: { name?: string; values?: string[] }[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return out;
  for (const f of fieldData) {
    const name = f.name?.trim().toLowerCase();
    const value = f.values?.[0]?.trim();
    if (name && value) out[name] = value;
  }
  return out;
}

function pick(map: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = map[k];
    if (v) return v;
  }
  return undefined;
}

/**
 * GET /{lead_id} with a Page access token that has leads_retrieval.
 * Never throws — returns null on failure so the webhook can 200 and retry later if needed.
 */
export async function fetchMetaLead(
  leadId: string,
  pageAccessToken: string,
): Promise<FetchedMetaLead | null> {
  const id = normalizeMetaLeadId(leadId);
  if (!id || !pageAccessToken.trim()) return null;
  try {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${id}`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("fields", "id,created_time,field_data");
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      created_time?: string | number;
      field_data?: { name?: string; values?: string[] }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      log.error({ status: res.status, error: json.error?.message, leadId: id }, "meta leadgen fetch failed");
      return null;
    }
    const map = fieldMap(json.field_data);
    const email = pick(map, ["email", "email_address"]);
    const phone = pick(map, ["phone_number", "phone", "mobile_number", "work_phone_number"]);
    const composed = [pick(map, ["first_name"]), pick(map, ["last_name"])].filter(Boolean).join(" ").trim();
    const fullName = pick(map, ["full_name", "fullname"]) ?? (composed || undefined);
    let createdTime: number | undefined;
    if (typeof json.created_time === "number") createdTime = json.created_time;
    else if (typeof json.created_time === "string") {
      const ms = Date.parse(json.created_time);
      if (Number.isFinite(ms)) createdTime = Math.floor(ms / 1000);
    }
    return { leadId: id, createdTime, fieldData: map, email, phone, fullName };
  } catch (err) {
    log.error({ err, leadId: id }, "meta leadgen fetch request failed");
    return null;
  }
}
