// Canonical statuses the package reasons about; apps map these onto their own payments enum.
export type PaymentLifecycle =
  | "awaiting_payment"
  | "pending_verification"
  | "paid"
  | "rejected"
  | "refunded";

export function canClaim(status: PaymentLifecycle): boolean {
  return status === "awaiting_payment" || status === "rejected";
}

export function canVerify(status: PaymentLifecycle): boolean {
  return status === "pending_verification";
}
