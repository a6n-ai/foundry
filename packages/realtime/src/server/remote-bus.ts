import type { Channel, RealtimeEvent } from "../index";
import type { Bus } from "./bus";
import { memoryBus } from "./memory-bus";

// App-side bus that publishes to the realtime Worker over HTTP; clients
// subscribe to the Worker directly, never through the app.
export function createRemoteBus(opts: { url: string; secret: string; fetch?: typeof fetch }): Bus {
  const doFetch = opts.fetch ?? fetch;
  const base = opts.url.replace(/\/+$/, "");
  return {
    async publish(channel: Channel, event: RealtimeEvent) {
      const res = await doFetch(`${base}/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ channel, event }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`RemoteBus: publish failed (${res.status})`);
    },
    subscribe() {
      throw new Error("RemoteBus: clients subscribe via the realtime Worker");
    },
  };
}

// No `= process.env` default: apps augment ProcessEnv, which trips the weak-type check.
export function pickBus(env?: { REALTIME_URL?: string; REALTIME_SECRET?: string }): Bus {
  const e = env ?? { REALTIME_URL: process.env.REALTIME_URL, REALTIME_SECRET: process.env.REALTIME_SECRET };
  return e.REALTIME_URL && e.REALTIME_SECRET
    ? createRemoteBus({ url: e.REALTIME_URL, secret: e.REALTIME_SECRET })
    : memoryBus;
}
