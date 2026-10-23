"use client";

import type { RealtimeEvent } from "../index";

const PING_MS = 30_000;
const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILED_OPENS = 3;
const STABLE_MS = 10_000;

// Per page load: once the token route says 404 this app has no Worker.
let noWorker = false;
export function resetOpenChannelForTests() {
  noWorker = false;
}

// Picks the transport: WebSocket via the app's realtime Worker, else the app's own SSE
// route (token route 404), else a slow poll after repeated failed opens. Returns
// synchronously; the returned function stops sockets, timers and retries.
export function openChannel(channel: string, onEvent: (e: RealtimeEvent) => void): () => void {
  let closed = false;
  let failures = 0;
  let backoff = 1_000;
  let ws: WebSocket | undefined;
  let es: EventSource | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let stableTimer: ReturnType<typeof setTimeout> | undefined;

  const deliver = (raw: string) => {
    try {
      onEvent(JSON.parse(raw) as RealtimeEvent);
    } catch {
      /* ignore malformed frame */
    }
  };

  // Only WebSocket open failures count toward polling; token-route trouble just retries.
  const failedOpen = () => {
    if (++failures >= MAX_FAILED_OPENS) {
      // ponytail: no WS retry while polling; add a 5-min retry if users report stale presence
      pollTimer = setInterval(() => onEvent({ type: "message", channel }), POLL_MS);
      return;
    }
    scheduleReconnect();
  };

  const scheduleReconnect = () => {
    retryTimer = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  };

  const openSocket = (url: unknown, token: unknown) => {
    let socket: WebSocket;
    try {
      if (typeof url !== "string" || typeof token !== "string") throw new Error("bad token response");
      socket = new WebSocket(`${url.replace(/\/+$/, "").replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
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
      if (closed) return;
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
    if (noWorker) return openEventSource();
    let res: Response;
    try {
      res = await fetch(`/api/realtime/token?channel=${encodeURIComponent(channel)}`);
    } catch {
      if (!closed) scheduleReconnect();
      return;
    }
    if (closed) return;
    if (res.status === 403) return;
    if (res.status === 404) {
      noWorker = true;
      return openEventSource();
    }
    if (res.status !== 200) return scheduleReconnect();
    let body: { url?: unknown; token?: unknown };
    try {
      body = await res.json();
    } catch {
      if (!closed) scheduleReconnect();
      return;
    }
    if (closed) return;
    openSocket(body?.url, body?.token);
  };

  void connect();

  return () => {
    closed = true;
    clearInterval(pingTimer);
    clearTimeout(stableTimer);
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    ws?.close();
    es?.close();
  };
}
