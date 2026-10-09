import type { IntegrationsConfigStore } from "@foundry/commons/plugin";
import type { CardFunding } from "./surcharge";

export type StripeDeps = {
  store: IntegrationsConfigStore;
  masterKey: () => string | undefined;
};

export type IntentStatus = {
  piId: string;
  status: "succeeded" | "processing" | "requires_action" | "requires_payment_method" | "canceled" | "other";
  amountReceivedCents: number;
  currency: string;
  paymentRef: string | null;
  created: number;
};

export type IntentResult = {
  status: "succeeded" | "processing" | "requires_action" | "failed";
  piId: string | null;
  clientSecret: string | null;
  reason?: string;
};

export type CardPreview = { funding: CardFunding; brand: string | null; last4: string | null };
