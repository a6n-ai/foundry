import type Stripe from "stripe";

export type TaxAddress = { line1: string; city?: string | null; postalCode: string; province?: string | null };
export type TaxQuote = {
  calculationId: string; taxCents: number; totalCents: number; expiresAt: number | null;
  lines: { label: string; ratePct: number; amountCents: number }[];
  reasons: string[];
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Stripe Tax timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function calculateTax(
  stripe: Stripe,
  i: { amountCents: number; taxCode: string; reference: string; address: TaxAddress },
  timeoutMs = 3000,
): Promise<TaxQuote> {
  const calc = await withTimeout(stripe.tax.calculations.create({
    currency: "cad",
    line_items: [{ amount: i.amountCents, reference: i.reference, tax_code: i.taxCode, tax_behavior: "exclusive" }],
    customer_details: {
      address: { line1: i.address.line1, city: i.address.city ?? undefined, postal_code: i.address.postalCode, state: i.address.province ?? undefined, country: "CA" },
      address_source: "shipping",
    },
  }), timeoutMs);
  return {
    calculationId: calc.id!,
    taxCents: calc.tax_amount_exclusive,
    totalCents: calc.amount_total,
    expiresAt: calc.expires_at ? calc.expires_at * 1000 : null,
    lines: calc.tax_breakdown
      .filter((b) => b.amount > 0)
      .map((b) => ({
        label: (b.tax_rate_details?.tax_type ?? "tax").toUpperCase(),
        ratePct: Number(b.tax_rate_details?.percentage_decimal ?? 0),
        amountCents: b.amount,
      })),
    reasons: calc.tax_breakdown.map((b) => b.taxability_reason),
  };
}

export async function commitTax(stripe: Stripe, calculationId: string, reference: string): Promise<string> {
  const tx = await stripe.tax.transactions.createFromCalculation({ calculation: calculationId, reference }, { idempotencyKey: `taxcommit:${reference}` });
  return tx.id;
}

export async function listTaxCodes(stripe: Stripe) {
  const out: { id: string; name: string; description: string }[] = [];
  for await (const c of stripe.taxCodes.list({ limit: 100 })) out.push({ id: c.id, name: c.name, description: c.description });
  return out;
}

export async function taxReadiness(stripe: Stripe, taxCode: string) {
  const settings = await stripe.tax.settings.retrieve();
  const regs = await stripe.tax.registrations.list({ status: "active", limit: 50 });
  let testReason: string | null = null;
  try {
    const q = await calculateTax(stripe, { amountCents: 10000, taxCode, reference: "readiness", address: { line1: "100 Queen St W", city: "Toronto", postalCode: "M5H 2N2", province: "ON" } }, 8000);
    testReason = q.reasons[0] ?? null;
  } catch { testReason = null; }
  const settingsActive = settings.status === "active";
  const registrations = regs.data.map((r) => r.country);
  return { settingsActive, registrations, testReason, ok: settingsActive && registrations.length > 0 && testReason != null && testReason !== "not_collecting" };
}
