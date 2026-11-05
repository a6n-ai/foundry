import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openChannel, resetOpenChannelForTests } from "../open-channel";

class FakeWS {
  static all: FakeWS[] = [];
  sent: string[] = [];
  closed = false;
  onopen?: () => void;
  onmessage?: (m: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  constructor(public url: string) {
    FakeWS.all.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

class FakeES {
  static all: FakeES[] = [];
  closed = false;
  onmessage?: (m: { data: string }) => void;
  constructor(public url: string) {
    FakeES.all.push(this);
  }
  close() {
    this.closed = true;
  }
}

const ok = (body: unknown) => ({ status: 200, ok: true, json: async () => body });
const status = (s: number) => ({ status: s, ok: false, json: async () => ({}) });

/** Minimal b64url payload with expiry far in the future (cache/bootstrap tests). */
function fakeToken(expSec = Math.floor(Date.now() / 1000) + 600): string {
  const part = btoa(JSON.stringify({ c: "c", u: "u", r: "customer", e: expSec }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${part}.sig`;
}

let fetchMock: ReturnType<typeof vi.fn>;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  resetOpenChannelForTests();
  vi.useFakeTimers();
  FakeWS.all = [];
  FakeES.all = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeWS);
  vi.stubGlobal("EventSource", FakeES);
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("openChannel", () => {
  it("uses EventSource when token route returns 404", async () => {
    fetchMock.mockResolvedValue(status(404));
    const onEvent = vi.fn();
    const close = openChannel("a b", onEvent);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/realtime/token?channel=a%20b");
    expect(FakeES.all[0]!.url).toBe("/api/realtime?channel=a%20b");
    FakeES.all[0]!.onmessage!({ data: JSON.stringify({ type: "message", channel: "a b" }) });
    FakeES.all[0]!.onmessage!({ data: "{bad" });
    expect(onEvent).toHaveBeenCalledTimes(1);
    close();
    expect(FakeES.all[0]!.closed).toBe(true);
  });

  it("does nothing when token route returns 403", async () => {
    fetchMock.mockResolvedValue(status(403));
    openChannel("c", vi.fn());
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeES.all).toHaveLength(0);
    expect(FakeWS.all).toHaveLength(0);
  });

  it("does nothing when token route returns 401", async () => {
    fetchMock.mockResolvedValue(status(401));
    openChannel("c", vi.fn());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeES.all).toHaveLength(0);
    expect(FakeWS.all).toHaveLength(0);
  });

  it("opens wss socket with token and forwards parsed events", async () => {
    const token = fakeToken();
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token }));
    const onEvent = vi.fn();
    openChannel("c", onEvent);
    await flush();
    const ws = FakeWS.all[0]!;
    expect(ws.url).toBe(`wss://rt.test/ws?token=${encodeURIComponent(token)}`);
    ws.onopen!();
    const ev = { type: "typing", userId: "u", role: "admin", typing: true };
    ws.onmessage!({ data: JSON.stringify(ev) });
    ws.onmessage!({ data: "{bad" });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(ev);
  });

  it("sends ping every 30s and does not forward pong", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const onEvent = vi.fn();
    openChannel("c", onEvent);
    await flush();
    const ws = FakeWS.all[0]!;
    ws.onopen!();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ws.sent).toEqual(["ping"]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ws.sent).toEqual(["ping", "ping"]);
    ws.onmessage!({ data: "pong" });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("reconnects with a cached token after an unclean close when still valid", async () => {
    const token = fakeToken();
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token }));
    openChannel("c", vi.fn());
    await flush();
    FakeWS.all[0]!.onopen!();
    FakeWS.all[0]!.onclose!();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeWS.all[1]!.url).toContain("wss://rt.test/ws?token=");
  });

  it("falls back to polling after 3 failed opens", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await flush();
    FakeWS.all[0]!.onclose!();
    await vi.advanceTimersByTimeAsync(1_000);
    FakeWS.all[1]!.onerror!();
    await vi.advanceTimersByTimeAsync(2_000);
    FakeWS.all[2]!.onclose!();
    expect(FakeWS.all).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(onEvent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
    await vi.advanceTimersByTimeAsync(600_000);
    expect(FakeWS.all).toHaveLength(3);
  });

  it("token route 504 three times falls back to polling, not infinite retries", async () => {
    fetchMock.mockResolvedValue(status(504));
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries the token route after a network error", async () => {
    const token = fakeToken();
    fetchMock
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce(ok({ url: "https://rt.test", token }));
    openChannel("c", vi.fn());
    await flush();
    expect(FakeWS.all).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWS.all[0]!.url).toContain("wss://rt.test/ws?token=");
  });

  it("WebSocket constructor throw counts as a failed open", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor() {
          throw new Error("blocked");
        }
      },
    );
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
  });

  it("socket that drops right after open keeps backing off and reaches polling after 3 drops", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await flush();
    FakeWS.all[0]!.onopen!();
    FakeWS.all[0]!.onclose!();
    await vi.advanceTimersByTimeAsync(1_000);
    FakeWS.all[1]!.onopen!();
    FakeWS.all[1]!.onclose!();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(FakeWS.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    FakeWS.all[2]!.onopen!();
    FakeWS.all[2]!.onclose!();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWS.all).toHaveLength(3);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
  });

  it("second openChannel after a 404 skips the token fetch", async () => {
    fetchMock.mockResolvedValue(status(404));
    openChannel("a", vi.fn());
    await flush();
    openChannel("b", vi.fn());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeES.all.map((e) => e.url)).toEqual(["/api/realtime?channel=a", "/api/realtime?channel=b"]);
  });

  it("strips trailing slashes from the worker url", async () => {
    const token = fakeToken();
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test/", token }));
    openChannel("c", vi.fn());
    await flush();
    expect(FakeWS.all[0]!.url).toBe(`wss://rt.test/ws?token=${encodeURIComponent(token)}`);
  });

  it("a non-string token in a 200 body counts as a failed open", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: 5 }));
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await vi.advanceTimersByTimeAsync(3_000 + 60_000);
    expect(FakeWS.all).toHaveLength(0);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
  });

  it("reconnect backoff resets once a socket stays open 10s", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    openChannel("c", vi.fn());
    await flush();
    FakeWS.all[0]!.onopen!();
    await vi.advanceTimersByTimeAsync(10_000);
    FakeWS.all[0]!.onclose!();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWS.all).toHaveLength(2);
  });

  it("close function stops socket, timers and retries", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const onEvent = vi.fn();
    const close = openChannel("c", onEvent);
    await flush();
    const ws = FakeWS.all[0]!;
    ws.onopen!();
    close();
    expect(ws.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ws.sent).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeWS.all).toHaveLength(1);
  });

  it("opens nothing when closed before the token fetch resolves", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const close = openChannel("c", vi.fn());
    close();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeWS.all).toHaveLength(0);
    expect(FakeES.all).toHaveLength(0);
  });

  it("close during a pending retry cancels the retry and polling", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    const onEvent = vi.fn();
    const close = openChannel("c", onEvent);
    await flush();
    FakeWS.all[0]!.onclose!();
    close();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("uses bootstrap token and skips the first fetch", async () => {
    const token = fakeToken();
    openChannel("c", vi.fn(), { bootstrap: { url: "https://rt.test", token } });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeWS.all[0]!.url).toBe(`wss://rt.test/ws?token=${encodeURIComponent(token)}`);
  });

  it("pauses on document hidden and reconnects on visible", async () => {
    const listeners = new Map<string, () => void>();
    const doc = {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    vi.stubGlobal("document", doc);
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: fakeToken() }));
    openChannel("c", vi.fn());
    await flush();
    expect(FakeWS.all).toHaveLength(1);
    FakeWS.all[0]!.onopen!();

    doc.visibilityState = "hidden";
    listeners.get("visibilitychange")!();
    expect(FakeWS.all[0]!.closed).toBe(true);

    const fetchesBefore = fetchMock.mock.calls.length;
    doc.visibilityState = "visible";
    listeners.get("visibilitychange")!();
    await flush();
    // Cache still valid — no new token fetch.
    expect(fetchMock.mock.calls.length).toBe(fetchesBefore);
    expect(FakeWS.all).toHaveLength(2);
  });
});
