/** Fail-closed floor on the shared secret, enforced by the Worker, `pickBus` and the apps. */
export const MIN_REALTIME_SECRET = 32;

type Env = { REALTIME_URL?: string; REALTIME_SECRET?: string };

/** Null means no usable Worker config (unset, or secret below the floor): SSE fallback + in-process bus. */
export function realtimeConfigFromEnv(env?: Env): { url: string; secret: string } | null {
  const e = env ?? { REALTIME_URL: process.env.REALTIME_URL, REALTIME_SECRET: process.env.REALTIME_SECRET };
  return e.REALTIME_URL && e.REALTIME_SECRET && e.REALTIME_SECRET.length >= MIN_REALTIME_SECRET
    ? { url: e.REALTIME_URL, secret: e.REALTIME_SECRET }
    : null;
}
