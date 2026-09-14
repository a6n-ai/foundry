---
name: next-foundry-app
description: >
  Wire @foundry/* packages into a Next.js 16 app. Use when adding Foundry to a
  consumer, fixing Turbopack "Unknown module type", transpilePackages, CSS
  @source of node_modules/@foundry, CrmShell slots, or git-hosted github:a6n-ai/foundry
  path deps. Pair with foundry-auth for Better Auth. Realm scaffolding is the
  sibling repo's scaffold-client skill.
---

# Next.js + Foundry

Foundry is **packages only**. Consumers (Realm, Relay, Monarch) install
`github:a6n-ai/foundry#path:packages/<name>`. Do not nest a `foundry/` tree
inside the consumer. Foundry never imports Relay.

Read `packages/*/package.json` `exports` before inventing import paths.

## transpilePackages

Git-hosted `@foundry/*` ship **raw `.ts` / `.tsx`** (no build step). Every
package the app (or a client component it imports) executes must be listed in
`next.config.ts` `transpilePackages`.

Also add those packages as **direct** `dependencies`. Nested tarball deps are
not enough — Turbopack reports `Unknown module type` for `@foundry/realtime`
when it is only a transitive dep of `@foundry/design-system`. Same for
`@foundry/email` when `@foundry/auth` pulls it.

Typical CRM app list:

```
@foundry/commons, @foundry/database, @foundry/routes, @foundry/themes,
@foundry/ui, @foundry/design-system, @foundry/realtime, @foundry/crm,
@foundry/auth, @foundry/auth-ui, @foundry/email
```

Plus `@relay/email` if the app sends mail. Commerce packages (`clover`,
`payments`, …) only when the app actually depends on them.

Set `outputFileTracingRoot` and `turbopack.root` to the consumer monorepo root.

## CSS

In the app `globals.css`:

```css
@source "../../../node_modules/@foundry/ui/src";
@source "../../../node_modules/@foundry/design-system/src";
@source "../../../node_modules/@foundry/crm/src";
@source "../../../node_modules/@foundry/auth-ui/src";
```

Adjust the relative path from the CSS file to `node_modules`. Theme tokens
come from `@foundry/themes`. Scope admin chrome (`.crm-app`) so public resets
do not leak into CRM.

## Graph (keep acyclic)

`commons` / `themes` floor → `ui` → `design-system` → `crm`. Lower layers never
import up. **`crm` never imports an app.**

`<CrmShell>` is slot-based: `sidebar`, `brand`, `breadcrumbs`, `actions`,
`footer`, `bottomNav`, `getSession` / role groupings stay in the app.

```tsx
<CrmShell
  hideSidebarOnMobile
  brand={...}
  sidebar={...}
  breadcrumbs={...}
  actions={...}
  bottomNav={...}
>
  {children}
</CrmShell>
```

Invites: `@foundry/crm` `UserInviteDialog`. Plugin catalog cards also live here.

## IDs

Snowflake `next_id()` / `current_app_id()` are **app migration SQL**, not a
Foundry export. `drizzle-kit generate` omits them on a baseline squash — splice
back from the previous baseline. Never rewrite an applied migration.

## Auth UI / Better Auth

See [foundry-auth](../foundry-auth/SKILL.md).
