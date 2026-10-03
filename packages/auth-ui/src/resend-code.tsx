"use client";

import { useEffect, useState } from "react";

export interface ResendCodeProps {
  /** Sends a fresh code. A rejection re-enables the link at once so a failed send never costs a wait. */
  onResend: () => Promise<unknown>;
  /**
   * Wait before each resend, in seconds. The first entry runs from mount (the
   * screen appears right after the first send); later sends step through the
   * rest and stay on the last, so repeated taps can't hammer the mail provider.
   */
  cooldowns?: readonly number[];
  className?: string;
}

const DEFAULT_COOLDOWNS = [30, 60, 120] as const;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "Resend in 0:24" countdown that turns into a resend link. */
export function ResendCode({ onResend, cooldowns = DEFAULT_COOLDOWNS, className }: ResendCodeProps) {
  const [sends, setSends] = useState(0);
  // A deadline, not a decrementing counter: background tabs throttle timers,
  // and the countdown must still be right when the user comes back from mail.
  const [until, setUntil] = useState(() => Date.now() + cooldowns[0]! * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [left]);

  async function resend() {
    setStatus("sending");
    try {
      await onResend();
    } catch {
      setStatus("failed");
      return;
    }
    const next = sends + 1;
    setSends(next);
    const start = Date.now();
    setUntil(start + cooldowns[Math.min(next, cooldowns.length - 1)]! * 1000);
    setNow(start);
    setStatus("sent");
  }

  return (
    <div className={`text-muted-foreground flex flex-col items-center gap-1 text-sm ${className ?? ""}`}>
      {left > 0 ? (
        <p className="tabular-nums">
          Didn&apos;t get it? Resend in <span className="text-foreground font-medium">{clock(left)}</span>
        </p>
      ) : (
        <p>
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="text-primary -mx-1 rounded-md px-1 py-2 font-medium underline-offset-4 hover:underline focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-3 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Resend code"}
          </button>
        </p>
      )}
      <p role="status" aria-live="polite" className="min-h-5">
        {status === "sent" ? "New code sent. Use the newest email." : status === "failed" ? "Couldn't send a code. Try again." : ""}
      </p>
    </div>
  );
}
