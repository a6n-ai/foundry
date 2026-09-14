# Foundry — agent guide

Foundry is **packages only** (`@foundry/*`). There are no apps here. Foundry
never imports Relay (email contract is `@foundry/email`; SES lives in
`@relay/email`).

Orientation: [`README.md`](README.md).

## Skills

Committed skills live in `.claude/skills/` (allowlisted in `.gitignore`):

- `next-foundry-app` — `transpilePackages`, CSS `@source`, CrmShell slots, git-hosted source
- `foundry-auth` — Better Auth + `@foundry/auth` + `@foundry/auth-ui`

Realm’s `scaffold-client` skill (sibling `realm` repo) copies a lean app and
then follows these two.

## Graph

`commons` / `themes` floor → `ui` → `design-system` → `crm`. Lower layers never
import up. `crm` never imports an app — `<CrmShell>` is slot-based.

Packages ship raw `.ts` / `.tsx`. Consumers must `transpilePackages` and declare
**direct** dependencies for anything a client component executes, including
nested packages such as `@foundry/realtime`.
