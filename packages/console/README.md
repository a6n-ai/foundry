# @foundry/console

Framework-neutral console UI: app shell, page header, tabs, resource table, toolbar, filters, pager, dialogs and feedback states. Built on `@foundry/ui`. It imports no router (`next/*`, `@tanstack/*` are banned by `boundary.test.ts`); routing goes through an adapter the app injects.

## Adapter contract

```ts
interface ConsoleRouter {
  Link: ComponentType<ConsoleLinkProps>   // { to, search?, replace?, ...anchor props }
  useSearch(): ConsoleSearch              // current URL search as an object
  usePathname(): string
  useNavigate(): ConsoleNavigate          // ({ to?, search: obj | (prev) => obj, replace? }) => void
}
```

The adapter `Link` must forward `ref` and every anchor prop and event handler (`onClick`, `onKeyDown`, `aria-*`, `data-*`) unchanged: menus, tooltips and `Button render` clone it, and a dropped ref or handler breaks keyboard navigation silently.

Wrap the app once in `<ConsoleRouterProvider router={router}>`. URL filter state (`useUrlFilter`, `Pager`, `SearchTabs`) reads and writes only through this adapter.

## Tailwind

Consumers need the package in their CSS sources:

```css
@source "../node_modules/@foundry/console/src";
```

## TanStack adapter

```tsx
import { Link, useNavigate, useRouterState, useSearch } from "@tanstack/react-router"
import type { ConsoleRouter } from "@foundry/console/router"

export const router: ConsoleRouter = {
  Link: ({ to, search, replace, ...rest }) => <Link to={to as never} search={search as never} replace={replace} {...rest} />,
  useSearch: () => useSearch({ strict: false }) as Record<string, unknown>,
  usePathname: () => useRouterState({ select: (s) => s.location.pathname }),
  useNavigate: () => {
    const navigate = useNavigate()
    return ({ to, search, replace }) => void navigate({ to: to ?? ".", search: search as never, replace })
  },
}
```

## Tests

`@foundry/console/testing` exports `createMemoryConsoleRouter({ pathname?, search? })`; its `calls` array records every navigate.
