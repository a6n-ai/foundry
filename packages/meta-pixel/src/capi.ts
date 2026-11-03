import { createLogger } from "@foundry/commons/logger";
import type { MetaConnection } from "./config";
import type { MetaCustomData, SendMetaEventArgs } from "./types";
import { buildMetaUserData } from "./user-data";

const log = createLogger("meta-capi");

/** Confirmed current stable from https://developers.facebook.com/docs/graph-api/changelog/versions/ */
export const META_GRAPH_API_VERSION = "v26.0";

const TIMEOUT_MS = 5_000;

function customPayload(data: MetaCustomData | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  if (data.value != null && Number.isFinite(data.value)) out.value = data.value;
  if (data.currency) out.currency = data.currency;
  if (data.content_ids?.length) out.content_ids = data.content_ids;
  if (data.content_type) out.content_type = data.content_type;
  if (data.content_name) out.content_name = data.content_name;
  if (data.num_items != null && Number.isFinite(data.num_items)) out.num_items = data.num_items;
  if (data.order_id) out.order_id = data.order_id;
  return Object.keys(out).length ? out : undefined;
}

/** The JSON body for one event, without the token. Null without an event_id (Meta could never dedupe it). */
export function buildMetaCapiBody(args: SendMetaEventArgs, testEventCode?: string | null): Record<string, unknown> | null {
  const eventId = args.eventId?.trim();
  if (!eventId) return null;

  const event: Record<string, unknown> = {
    event_name: args.eventName,
    event_time: args.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: eventId,
    // Meta requires client_user_agent on website events. A send with no customer browser
    // (staff verify, a webhook) goes out as system_generated and matches on em/ph.
    action_source: args.userData.clientUserAgent?.trim() ? "website" : "system_generated",
    user_data: buildMetaUserData(args.userData),
  };
  const url = args.eventSourceUrl?.trim();
  if (url) event.event_source_url = url;
  const custom_data = customPayload(args.customData);
  if (custom_data) event.custom_data = custom_data;

  const body: Record<string, unknown> = { data: [event] };
  if (testEventCode) body.test_event_code = testEventCode;
  return body;
}

export type MetaSendResult = { ok: true; eventsReceived: number } | { ok: false; error: string };

/**
 * POST one event to the Conversions API. Never throws. Awaitable, so a settings "Send test
 * event" can show Meta's answer; fire-and-forget callers wrap it in their runtime's waitUntil.
 */
export async function postMetaEvent(conn: MetaConnection | null, args: SendMetaEventArgs): Promise<MetaSendResult> {
  if (!conn) return { ok: false, error: "Meta Pixel is not connected: save a pixel ID and access token" };
  const body = buildMetaCapiBody(args, conn.testEventCode);
  if (!body) {
    log.warn({ eventName: args.eventName }, "meta capi skipped: missing event_id");
    return { ok: false, error: "Missing event_id" };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${conn.pixelId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, access_token: conn.token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) {
      const error = json.error?.message ?? `Meta returned ${res.status}`;
      log.error({ status: res.status, error, eventName: args.eventName, eventId: args.eventId }, "meta capi HTTP error");
      return { ok: false, error };
    }
    return { ok: true, eventsReceived: json.events_received ?? 0 };
  } catch (err) {
    log.error({ err, eventName: args.eventName, eventId: args.eventId }, "meta capi request failed");
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Meta" };
  }
}
