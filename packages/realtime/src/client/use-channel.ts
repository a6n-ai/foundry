"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "../index";
import { openChannel } from "./open-channel";

// Subscribe to a channel (WebSocket via the realtime Worker, else SSE). onEvent is kept
// in a ref so callers can pass a fresh closure each render without reconnecting.
export function useChannel(channel: string | null, onEvent: (e: RealtimeEvent) => void): void {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  useEffect(() => (channel ? openChannel(channel, (e) => ref.current(e)) : undefined), [channel]);
}
