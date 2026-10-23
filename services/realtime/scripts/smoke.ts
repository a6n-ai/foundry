import { request } from "node:http";
import { signRealtimeToken } from "@foundry/realtime";

const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const SECRET = process.env.SECRET ?? "";
const CH = "ticket:t1";

// workers-types declares `process: any`, so process.exit() can't type as never here.
function fail(msg: string): never {
  throw new Error(`smoke FAILED: ${msg}`);
}

type Sock = { ws: WebSocket; frames: string[] };
async function open(userId: string, role: "staff" | "customer"): Promise<Sock> {
  const token = await signRealtimeToken(SECRET, { channel: CH, userId, role });
  const ws = new WebSocket(`${BASE.replace("http", "ws")}/ws?token=${token}`);
  const frames: string[] = [];
  ws.addEventListener("message", (m) => frames.push(String(m.data)));
  await new Promise<void>((res, rej) => {
    ws.addEventListener("open", () => res());
    ws.addEventListener("error", () => rej(new Error(`ws open failed for ${userId}`)));
  });
  return { ws, frames };
}

async function waitFor(s: Sock, pred: (f: string) => boolean, what: string) {
  for (let i = 0; i < 50; i++) {
    if (s.frames.some(pred)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  fail(`timed out waiting for ${what}; got ${JSON.stringify(s.frames)}`);
}

const A = await open("c1", "customer");
const B = await open("s1", "staff");
await waitFor(A, (f) => f.includes('"userId":"s1"') && f.includes('"online":true'), "A sees s1 online");

const pub = await fetch(`${BASE}/publish`, {
  method: "POST",
  headers: { authorization: `Bearer ${SECRET}` },
  body: JSON.stringify({ channel: CH, event: { type: "message", channel: CH } }),
});
if (pub.status !== 204) fail(`publish status ${pub.status}`);
const isMsg = (f: string) => f.includes('"type":"message"');
await waitFor(A, isMsg, "A gets message");
await waitFor(B, isMsg, "B gets message");

A.ws.send("ping");
await waitFor(A, (f) => f === "pong", "pong");

B.ws.close();
await waitFor(A, (f) => f.includes('"userId":"s1"') && f.includes('"online":false'), "A sees s1 offline");

const expired = await signRealtimeToken(SECRET, { channel: CH, userId: "x", role: "customer" }, 60, Date.now() - 120_000);
// undici's fetch forbids the Upgrade header, so use node:http
const status = await new Promise<number>((res, rej) => {
  const req = request(`${BASE}/ws?token=${expired}`, { headers: { upgrade: "websocket", connection: "Upgrade" } }, (r) => res(r.statusCode ?? 0));
  req.on("upgrade", () => res(101));
  req.on("error", rej);
  req.end();
});
if (status !== 401) fail(`expired token status ${status}`);

A.ws.close();
console.log("smoke ok");
