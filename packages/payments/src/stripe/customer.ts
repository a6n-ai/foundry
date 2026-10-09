import type Stripe from "stripe";

export type StripeCustomerStore = {
  get(userRef: string): Promise<string | null>;
  set(userRef: string, customerId: string): Promise<void>;
};

/** Lazy get-or-create. The idempotency key makes a concurrent double-create return the same customer. */
export async function ensureCustomer(stripe: Stripe, store: StripeCustomerStore, user: { ref: string; email: string; name?: string | null }): Promise<string> {
  const existing = await store.get(user.ref);
  if (existing) return existing;
  const c = await stripe.customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userRef: user.ref } },
    { idempotencyKey: `customer:${user.ref}` },
  );
  await store.set(user.ref, c.id);
  return c.id;
}
