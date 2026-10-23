"use client";

import type { RealtimeEvent } from "../index";

const PING_MS = 30_000;
const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILED_OPENS = 3;

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

  const deliver = (raw: string) => {
    try {
      onEvent(JSON.parse(raw) as RealtimeEvent);
    } catch {
      /* ignore malformed frame */
    }
  };

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

  const openSocket = (url: string, token: string) => {
    const socket = new WebSocket(`${url.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
    ws = socket;
    let opened = false;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      clearInterval(pingTimer);
      if (closed) return;
      if (opened) scheduleReconnect();
      else failedOpen();
    };
    socket.onopen = () => {
      opened = true;
      failures = 0;
      backoff = 1_000;
      pingTimer = setInterval(() => socket.send("ping"), PING_MS);
    };
    socket.onmessage = (m) => {
      if (m.data === "pong") return;
      deliver(m.data as string);
    };
    socket.onclose = end;
    socket.onerror = end;
  };

  const connect = async () => {
    let res: Response;
    try {
      res = await fetch(`/api/realtime/token?channel=${encodeURIComponent(channel)}`);
    } catch {
      if (!closed) failedOpen();
      return;
    }
    if (closed) return;
    if (res.status === 403) return;
    if (res.status === 404) {
      es = new EventSource(`/api/realtime?channel=${encodeURIComponent(channel)}`);
      es.onmessage = (m) => deliver(m.data);
      return;
    }
    if (res.status !== 200) return failedOpen();
    let body: { url: string; token: string };
    try {
      body = await res.json();
    } catch {
      if (!closed) failedOpen();
      return;
    }
    if (closed) return;
    openSocket(body.url, body.token);
  };

  void connect();

  return () => {
    closed = true;
    clearInterval(pingTimer);
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    ws?.close();
    es?.close();
  };
}
