# Foundry

Shared TypeScript packages (`@foundry/*`) for Realm apps, Relay, and Monarch (AI). This repo has **no apps**.

- Floor: commons, themes, ui, design-system, crm, auth, auth-ui, database, routes, storage, realtime, eslint-config
- Commerce: clover, payments, wallet, coupons, discounts, delivery, address, google-reviews, places
- Email provider/renderer types in `@foundry/commons`; apps inject `@relay/email`, so Foundry never imports Relay

Foundry never imports Relay.

```bash
pnpm install
pnpm typecheck
```

## License

Apache License 2.0. See [`LICENSE`](LICENSE). Products that consume Foundry (Relay, Realm) keep their own licenses; this repo does not become AGPL because an app imports `@foundry/*`.
