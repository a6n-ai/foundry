# @foundry/realtime-worker

One Durable Object (`ChannelRoom`) per channel, WebSocket Hibernation, SQLite-backed (Workers free plan).
HTTP: `GET /ws?token=` (upgrade), `POST /publish` (Bearer `REALTIME_SECRET`), `GET /`.

Adding an app (config lives in the app repo, not here):
1. In the app's `wrangler.jsonc`, add an `env.<app>` block with `name`, `routes` (custom domain), and
   repeat `durable_objects` (`ROOMS` -> `ChannelRoom`) and `migrations` (`v1`, `new_sqlite_classes`); envs do not inherit them.
2. `wrangler secret put REALTIME_SECRET --env <app>` (same value as the app's server env).
3. Point DNS / custom domain `rt.<app-domain>` at the Worker route.
4. Local: put `REALTIME_SECRET=dev-secret` in `.dev.vars` (gitignored), `pnpm dev`, then `SECRET=dev-secret pnpm smoke`.
