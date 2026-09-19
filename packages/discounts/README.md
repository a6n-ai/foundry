# @foundry/discounts

Central discounts + coupons contract. Pure, storage-agnostic, no I/O, no clock (`now` is injected). Amounts are positive dollars, rounded to cents. Re-exports everything from `@foundry/coupons`, so apps import both from here.

## Stacking rule

1. Catalog discounts ADD UP as percents of the pre-discount subtotal, capped by `maxDiscountPct`. Over the cap, every line is scaled proportionally; the last line absorbs rounding so lines sum exactly to the total.
2. Coupons (`@foundry/coupons`) then apply to what remains (`minSubtotal` is checked against the post-discount subtotal). Total off never exceeds the subtotal.

## API

- `resolveCatalogDiscounts(rules, { subtotal, maxDiscountPct })` -> `{ lines, totalPercent, totalAmount, capped }`
- `isRuleActive(rule, now)`
- `resolveCart({ subtotal, rules, maxDiscountPct, coupons, couponCtx })` -> `{ catalog, coupons, subtotalAfterCatalog, totalOff, finalSubtotal }`
- `rankDeals(current, alternatives, { limit?, minSavingPct? })`, `bestDeal(...)` - generic per-unit best-deal ranking
- everything from `@foundry/coupons`

## How an app adopts discounts & coupons

1. Add `"@foundry/discounts": "github:a6n-ai/foundry#path:packages/discounts"` as a direct dependency.
2. Add `@foundry/discounts` (and `@foundry/coupons`) to `transpilePackages` in `apps/<client>/next.config.ts` (see the `next-foundry-app` skill).
3. Persist rules and coupons in the app; load them, pre-filter with `isRuleActive` / applicability, map to `DiscountRule[]` and `CouponCandidate[]`.
4. Call `resolveCart` server-side with an injected `now`, and apply the result to the app's own order totals.
5. The app owns persistence, admin UI and order totals. Totals are computed server-side only; never trust client amounts.

TODO: `./schema` export (drizzle table factory) in a follow-up.
