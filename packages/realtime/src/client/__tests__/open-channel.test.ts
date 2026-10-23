import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openChannel } from "../open-channel";

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

let fetchMock: ReturnType<typeof vi.fn>;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  FakeWS.all = [];
  FakeES.all = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeWS);
  vi.stubGlobal("EventSource", FakeES);
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

  it("opens wss socket with token and forwards parsed events", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
    const onEvent = vi.fn();
    openChannel("c", onEvent);
    await flush();
    const ws = FakeWS.all[0]!;
    expect(ws.url).toBe("wss://rt.test/ws?token=t");
    ws.onopen!();
    const ev = { type: "typing", userId: "u", role: "admin", typing: true };
    ws.onmessage!({ data: JSON.stringify(ev) });
    ws.onmessage!({ data: "{bad" });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(ev);
  });

  it("sends ping every 30s and does not forward pong", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
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

  it("reconnects with a fresh token after an unclean close", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ url: "https://rt.test", token: "t1" }))
      .mockResolvedValueOnce(ok({ url: "https://rt.test", token: "t2" }));
    openChannel("c", vi.fn());
    await flush();
    FakeWS.all[0]!.onopen!();
    FakeWS.all[0]!.onclose!();
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWS.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeWS.all[1]!.url).toBe("wss://rt.test/ws?token=t2");
  });

  it("falls back to polling after 3 failed opens", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
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

  it("counts a rejected token fetch as a failed open", async () => {
    fetchMock.mockRejectedValue(new Error("net"));
    const onEvent = vi.fn();
    openChannel("chan", onEvent);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onEvent).toHaveBeenCalledWith({ type: "message", channel: "chan" });
  });

  it("close function stops socket, timers and retries", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
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
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
    const close = openChannel("c", vi.fn());
    close();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeWS.all).toHaveLength(0);
    expect(FakeES.all).toHaveLength(0);
  });

  it("close during a pending retry cancels the retry and polling", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://rt.test", token: "t" }));
    const onEvent = vi.fn();
    const close = openChannel("c", onEvent);
    await flush();
    FakeWS.all[0]!.onclose!();
    close();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
