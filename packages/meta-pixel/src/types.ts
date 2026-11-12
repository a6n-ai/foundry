/** Browser/request context captured on the customer's own request (checkout), not a webhook. */
export type MetaAttribution = {
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
  /** false when the buyer had not accepted analytics/ads cookies: no Purchase is sent for the order. */
  consent?: boolean;
};

export type MetaUserDataInput = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /**
   * Meta Lead Ads lead id (15–17 digits). Sent raw as `user_data.lead_id` — never hashed.
   * Highest-priority match key for CRM → Qualified Leads Conversions API events.
   */
  leadId?: string | number | null;
};

export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  num_items?: number;
  order_id?: string;
  /** Hashed postal is built server-side; this is the raw postal for FindLocation zp. */
  postalCode?: string;
  /** CRM Conversions API: always `"crm"` for Qualified Leads stage events. */
  event_source?: string;
  /** CRM Conversions API: CRM product name (e.g. `"TiffinGrab"`). */
  lead_event_source?: string;
};

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Lead"
  | "CompleteRegistration"
  | "Contact"
  | "FindLocation"
  | "Purchase";

/** Standard Pixel events, plus free-form CRM stage names (e.g. QualifiedLead). */
export type MetaCapiEventName = MetaEventName | (string & {});

export type MetaActionSource = "website" | "system_generated";

export type SendMetaEventArgs = {
  eventName: MetaCapiEventName;
  eventId: string;
  eventSourceUrl?: string | null;
  eventTime?: number;
  userData: MetaUserDataInput;
  customData?: MetaCustomData;
  /**
   * Override inferred action_source. CRM Qualified Leads must send
   * `system_generated` even when browser signals are attached.
   */
  actionSource?: MetaActionSource;
};
