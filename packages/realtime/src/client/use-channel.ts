"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "../index";
import { openChannel, type OpenChannelOptions } from "./open-channel";

// Subscribe to a channel (WebSocket via the realtime Worker, else SSE). onEvent is kept
// in a ref so callers can pass a fresh closure each render without reconnecting.
export function useChannel(
  channel: string | null,
  onEvent: (e: RealtimeEvent) => void,
  opts?: OpenChannelOptions,
): void {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  const bootstrap = opts?.bootstrap;
  useEffect(
    () => (channel ? openChannel(channel, (e) => ref.current(e), bootstrap ? { bootstrap } : undefined) : undefined),
    // bootstrap identity: reconnect when url/token change (shell remint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, bootstrap?.url, bootstrap?.token],
  );
}
