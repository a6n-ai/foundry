"use client";

import type { RealtimeEvent } from "../index";

const PING_MS = 30_000;
const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILED_OPENS = 3;
const STABLE_MS = 10_000;
/** Reuse a cached token until this many ms before its `e` expiry. */
const TOKEN_SKEW_MS = 30_000;

export type RealtimeBootstrap = { url: string; token: string };
export type OpenChannelOptions = { bootstrap?: RealtimeBootstrap };

type CachedCred = RealtimeBootstrap & { exp: number };

// Per page load: once the token route says 404 this app has no Worker.
let noWorker = false;
const tokenCache = new Map<string, CachedCred>();

export function resetOpenChannelForTests() {
  noWorker = false;
  tokenCache.clear();
}

/** Decode JWT-ish payload expiry without verifying the signature (cache gate only). */
export function tokenExpirySeconds(token: string): number | null {
  try {
    const part = token.split(".")[0];
    if (!part) return null;
    const bin = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(bin) as { e?: unknown };
    return typeof json.e === "number" ? json.e : null;
  } catch {
    return null;
  }
}

function cachePut(channel: string, url: string, token: string): void {
  const exp = tokenExpirySeconds(token);
  if (exp == null) return;
  tokenCache.set(channel, { url, token, exp });
}

function cacheGet(channel: string, now = Date.now()): RealtimeBootstrap | null {
  const c = tokenCache.get(channel);
  if (!c) return null;
  if (c.exp * 1000 - TOKEN_SKEW_MS <= now) {
    tokenCache.delete(channel);
    return null;
  }
  return { url: c.url, token: c.token };
}

function bootstrapOrCache(channel: string, bootstrap: RealtimeBootstrap | undefined): RealtimeBootstrap | null {
  if (bootstrap) {
    const exp = tokenExpirySeconds(bootstrap.token);
    if (exp != null && exp * 1000 - TOKEN_SKEW_MS > Date.now()) {
      cachePut(channel, bootstrap.url, bootstrap.token);
      return bootstrap;
    }
  }
  return cacheGet(channel);
}

// Picks the transport: WebSocket via the app's realtime Worker, else the app's own SSE
// route (token route 404), else a slow poll after repeated failed opens. Returns
// synchronously; the returned function stops sockets, timers and retries.
export function openChannel(
  channel: string,
  onEvent: (e: RealtimeEvent) => void,
  opts?: OpenChannelOptions,
): () => void {
  let closed = false;
  let paused = false;
  let failures = 0;
  let backoff = 1_000;
  let ws: WebSocket | undefined;
  let es: EventSource | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let bootstrap = opts?.bootstrap;

  const clearTransport = () => {
    clearInterval(pingTimer);
    clearTimeout(stableTimer);
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    pingTimer = undefined;
    stableTimer = undefined;
    retryTimer = undefined;
    pollTimer = undefined;
    ws?.close();
    ws = undefined;
    es?.close();
    es = undefined;
  };

  const deliver = (raw: string) => {
    try {
      onEvent(JSON.parse(raw) as RealtimeEvent);
    } catch {
      /* ignore malformed frame */
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => onEvent({ type: "message", channel }), POLL_MS);
  };

  // WS open failures and token-route 5xx share one budget, then poll — never retry 504 forever.
  const failedOpen = () => {
    if (++failures >= MAX_FAILED_OPENS) {
      startPolling();
      return;
    }
    scheduleReconnect();
  };

  const scheduleReconnect = () => {
    if (closed || paused) return;
    retryTimer = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  };

  const openSocket = (url: unknown, token: unknown) => {
    let socket: WebSocket;
    try {
      if (typeof url !== "string" || typeof token !== "string") throw new Error("bad token response");
      socket = new WebSocket(`${url.replace(/\/+$/, "").replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
      cachePut(channel, url.replace(/\/+$/, ""), token);
    } catch {
      failedOpen();
      return;
    }
    ws = socket;
    let stable = false;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      clearInterval(pingTimer);
      clearTimeout(stableTimer);
      if (closed || paused) return;
      if (stable) scheduleReconnect();
      else failedOpen();
    };
    socket.onopen = () => {
      pingTimer = setInterval(() => socket.send("ping"), PING_MS);
      // Reset only after it stays up, so an accept-then-drop Worker keeps backing off.
      stableTimer = setTimeout(() => {
        stable = true;
        failures = 0;
        backoff = 1_000;
      }, STABLE_MS);
    };
    socket.onmessage = (m) => {
      if (m.data === "pong") return;
      deliver(m.data as string);
    };
    socket.onclose = end;
    socket.onerror = end;
  };

  const openEventSource = () => {
    es = new EventSource(`/api/realtime?channel=${encodeURIComponent(channel)}`);
    es.onmessage = (m) => deliver(m.data);
  };

  const connect = async () => {
    if (closed || paused) return;
    if (noWorker) return openEventSource();

    const cached = bootstrapOrCache(channel, bootstrap);
    bootstrap = undefined; // one-shot; later reconnects use cache or fetch
    if (cached) {
      openSocket(cached.url, cached.token);
      return;
    }

    let res: Response;
    try {
      res = await fetch(`/api/realtime/token?channel=${encodeURIComponent(channel)}`);
    } catch {
      if (!closed && !paused) failedOpen();
      return;
    }
    if (closed || paused) return;
    if (res.status === 401 || res.status === 403) return;
    if (res.status === 404) {
      noWorker = true;
      return openEventSource();
    }
    if (res.status !== 200) {
      failedOpen();
      return;
    }
    let body: { url?: unknown; token?: unknown };
    try {
      body = await res.json();
    } catch {
      if (!closed && !paused) failedOpen();
      return;
    }
    if (closed || paused) return;
    openSocket(body?.url, body?.token);
  };

  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      paused = true;
      clearTransport();
      return;
    }
    if (closed) return;
    paused = false;
    failures = 0;
    backoff = 1_000;
    void connect();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "hidden") {
      paused = true;
    } else {
      void connect();
    }
  } else {
    void connect();
  }

  return () => {
    closed = true;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    clearTransport();
  };
}
