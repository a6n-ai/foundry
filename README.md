# Foundry

Shared TypeScript packages (`@foundry/*`) for Realm apps, Relay, and Monarch (AI). This repo has **no apps**.

- Floor: commons, themes, ui, design-system, crm, auth, auth-ui, database, routes, storage, realtime, eslint-config
- Commerce: clover, payments, wallet, coupons, google-reviews, order-tracking, places
- Email contract + render (`@foundry/email`) so Foundry never imports Relay; SES lives in `@relay/email`
- AI: `@foundry/ai` — Monarch packages live here, not in a separate monarch packages tree

Foundry never imports Relay.

```bash
pnpm install
pnpm typecheck
```

## License

Apache License 2.0. See [`LICENSE`](LICENSE). Products that consume Foundry (Relay, Realm) keep their own licenses; this repo does not become AGPL because an app imports `@foundry/*`.
