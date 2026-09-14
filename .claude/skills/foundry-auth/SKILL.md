---
name: foundry-auth
description: >
  Configure Better Auth 1.6 with @foundry/auth and @foundry/auth-ui in a Next.js
  16 consumer. Use when wiring login, email OTP, invites, permissions,
  createAccessControl, CrmShell auth, ChangePasswordForm, ForgotPasswordForm,
  CodeOtp, disableSignUp, passwordSet, or proxy.ts session gates.
---

# Foundry auth

`@foundry/auth` is server helpers. `@foundry/auth-ui` is client forms. Better Auth
(`1.6.x` — match the consumer lockfile) owns sessions. Do not reimplement
password/email/OTP screens.

## `@foundry/auth` exports

| Export | Use |
|---|---|
| `baseStatement`, `createAccessControl` | App `lib/auth/permissions.ts` |
| `createPermissionGuards` / `createRoleGuards` | Server actions; inject app `getSession` |
| `authAuditAction` | Map Better Auth paths → audit labels |
| `hashPassword` / `verifyPassword` | Credential helpers |
| `assertHierarchyDepth`, `resolveVisibleOrgIds` | Org tree |
| `sendOtpEmail`, `sendWelcomeVerify`, … | Email contract (`@foundry/email`, not Relay) |

App `permissions.ts` spreads `baseStatement` (Better Auth `user`/`session` plus
CRM `settings`/`audit`) and adds app resources. `admin` plugin gets `ac` + `roles`.
New code uses `requirePermission({ resource: ["action"] })`. Do not mount
ban/unban, `removeUser`, or impersonation unless the app has an audit story.

## Better Auth (consumer `lib/auth/index.ts`)

- `appName` set. Plugins from **dedicated** paths:
  `better-auth/plugins/email-otp`, `.../admin`, `.../organization` (tree-shake).
- Client: `better-auth/react` + `emailOTPClient` from `better-auth/client/plugins`.
- `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]` — do not trust
  `x-forwarded-for`’s leftmost token.
- `session.freshAge: 60 * 60`. Optional `cookieCache: { enabled, strategy: "compact", maxAge: 5 * 60 }`.
  If `getSession` maps `user.publicId` and a cache hit drops it, disable the cache.
- `emailAndPassword.disableSignUp: true` **and** `emailOTP({ disableSignUp: true })`.
  The two switches cover different routes. Customer self-serve is a **custom**
  action, not `/sign-up/email`.
- `revokeSessionsOnPasswordReset: true`. Invited staff start `passwordSet: false`;
  flip it in `onPasswordReset`.
- `users.status` is the only sign-in switch (`decideSessionAdmission`). Role
  decides **where**, not **whether**.
- Next 16: `proxy.ts` (not `middleware.ts`) gates `/dashboard` and `/me`.
- Default in-memory rate limits are one-process. Do not add a `rateLimit` table
  until the app scales past a single instance.

## `@foundry/auth-ui`

Wrap, do not fork:

- `ChangePasswordForm` — `authClient.changePassword({ revokeOtherSessions: true })`
- `ChangeEmailForm` — current-email OTP then new-email OTP
- `ForgotPasswordForm` — email OTP reset
- `CodeOtp` — login OTP

Keep wrappers in `components/auth/` so dashboard and customer account share them.
`useSearchParams` on login lives under a page-level `Suspense`. Account pages use
`Suspense` + skeleton (`SkeletonFormCard`).

## Roles

From `@foundry/commons`: `admin` / `member` / `user`. Staff → `/dashboard`,
customers → `/me`. `landingPathFor` must reject off-site `callbackUrl`s.
Members are invitable; only send them to `/no-access` if no dashboard page
admits `member`.

## Transpile

`@foundry/auth`, `@foundry/auth-ui`, and `@foundry/email` must be **direct**
deps and listed in `transpilePackages`. See `next-foundry-app`.
