import type { Channel, RealtimeEvent } from "../index";
import type { Bus } from "./bus";
import { realtimeConfigFromEnv } from "./config";
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
  const cfg = realtimeConfigFromEnv(env);
  return cfg ? createRemoteBus(cfg) : memoryBus;
}

/** The bus for this process from REALTIME_URL / REALTIME_SECRET: remote when configured, in-process otherwise. */
export const busFromEnv = (): Bus => pickBus();
