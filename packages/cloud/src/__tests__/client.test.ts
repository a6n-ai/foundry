import { describe, expect, it, vi } from "vitest";
import { AwsError, awsConfigFromEnv, createAwsClient } from "../index";

const credentials = { accessKeyId: "AKID", secretAccessKey: "secret" };
const cfg = (fetch: typeof globalThis.fetch) => ({ region: "us-east-1", credentials, fetch });
const opts = { retries: 0, timeoutMs: 1000 };
const ok = () => new Response('{"a":1}', { status: 200 });

function spy(...responses: Array<() => Response>) {
  let i = 0;
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => responses[Math.min(i++, responses.length - 1)]!());
}
const req = (call: unknown[]) => (call[0] instanceof Request ? call[0] : new Request(call[0] as string, call[1] as RequestInit));

describe("aws client", () => {
  it("signs request", async () => {
    const f = spy(ok);
    await createAwsClient("geo-maps", cfg(f)).json("https://maps.geo.us-east-1.amazonaws.com/v2/x", opts);
    expect(f).toHaveBeenCalledTimes(1);
    const r = req(f.mock.calls[0]!);
    const auth = r.headers.get("authorization")!;
    expect(auth.startsWith("AWS4-HMAC-SHA256 Credential=AKID/")).toBe(true);
    expect(auth).toContain("/us-east-1/geo-maps/aws4_request");
    expect(r.headers.get("x-amz-date")).toBeTruthy();
  });

  it("query is encoded once", async () => {
    const f = spy(ok);
    await createAwsClient("s3", cfg(f)).request("https://b.s3.amazonaws.com/k", { ...opts, query: { a: "b c+d", skip: undefined } });
    expect(req(f.mock.calls[0]!).url).toContain("a=b%20c%2Bd");
    expect(req(f.mock.calls[0]!).url).not.toContain("skip");
  });

  it("json error", async () => {
    const f = spy(() => new Response('{"__type":"ValidationException","message":"bad"}', { status: 400 }));
    const err = await createAwsClient("ses", cfg(f)).json("https://x.amazonaws.com/", opts).catch((e) => e);
    expect(err).toBeInstanceOf(AwsError);
    expect(err).toMatchObject({ code: "ValidationException", status: 400, message: "bad" });
  });

  it("json error with namespaced type", async () => {
    const f = spy(() => new Response('{"__type":"com.amazon#Throttling:http://x","Message":"slow"}', { status: 429 }));
    const err = await createAwsClient("ses", cfg(f)).json("https://x.amazonaws.com/", opts).catch((e) => e);
    expect(err).toMatchObject({ code: "Throttling", status: 429, message: "slow" });
  });

  it("xml error", async () => {
    const f = spy(() => new Response("<Error><Code>NoSuchKey</Code><Message>x</Message><RequestId>r1</RequestId></Error>", { status: 404 }));
    const err = await createAwsClient("s3", cfg(f)).request("https://b.s3.amazonaws.com/k", opts).catch((e) => e);
    expect(err).toMatchObject({ code: "NoSuchKey", status: 404, requestId: "r1" });
  });

  it("empty error body", async () => {
    const f = spy(() => new Response(null, { status: 404 }));
    const err = await createAwsClient("s3", cfg(f)).request("https://b.s3.amazonaws.com/k", { ...opts, method: "HEAD" }).catch((e) => e);
    expect(err).toMatchObject({ code: "NotFound", status: 404 });
  });

  it("missing creds", async () => {
    const f = spy(ok);
    const err = await createAwsClient("ses", { region: "us-east-1", fetch: f }).request("https://x.amazonaws.com/", opts).catch((e) => e);
    expect(err).toMatchObject({ code: "MissingCredentials" });
    expect(f).not.toHaveBeenCalled();
  });

  it("missing region", () => {
    expect(() => createAwsClient("ses", { credentials }).region).toThrowError(expect.objectContaining({ code: "MissingRegion" }));
  });

  it("retries passed", async () => {
    const f = spy(() => new Response("", { status: 500 }), ok);
    const res = await createAwsClient("ses", cfg(f)).request("https://x.amazonaws.com/", { ...opts, retries: 1 });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("rejects after retries exhausted", async () => {
    const f = spy(() => new Response("", { status: 503 }));
    const err = await createAwsClient("ses", cfg(f)).request("https://x.amazonaws.com/", { ...opts, retries: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AwsError);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx", async () => {
    const f = spy(() => new Response("", { status: 400 }));
    const err = await createAwsClient("ses", cfg(f)).request("https://x.amazonaws.com/", { ...opts, retries: 3 }).catch((e) => e);
    expect(err).toBeInstanceOf(AwsError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("json on empty 2xx body is undefined", async () => {
    const f = spy(() => new Response(null, { status: 200 }));
    expect(await createAwsClient("ses", cfg(f)).json("https://x.amazonaws.com/", opts)).toBeUndefined();
  });

  it("json body is serialized with content-type", async () => {
    const f = spy(ok);
    await createAwsClient("ses", cfg(f)).json("https://x.amazonaws.com/", { ...opts, method: "POST", json: { q: 1 } });
    const r = req(f.mock.calls[0]!);
    expect(r.method).toBe("POST");
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(await r.text()).toBe('{"q":1}');
  });

  it("timeout", async () => {
    const f = vi.fn((_i: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal!.reason))));
    const err = await createAwsClient("ses", cfg(f as never)).request("https://x.amazonaws.com/", { ...opts, timeoutMs: 10 }).catch((e) => e);
    expect(err).toBeTruthy();
  });

  it("presign", async () => {
    const url = await createAwsClient("s3", cfg(spy(ok))).presign("https://b.s3.amazonaws.com/k", { expiresIn: 900 });
    expect(url).toContain("X-Amz-Expires=900");
    expect(url).toContain("X-Amz-Signature=");
  });
});

describe("awsConfigFromEnv", () => {
  it("maps env vars", () => {
    expect(awsConfigFromEnv({ AWS_REGION: "eu-west-1", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "s", AWS_SESSION_TOKEN: "t" })).toEqual({
      region: "eu-west-1",
      credentials: { accessKeyId: "a", secretAccessKey: "s", sessionToken: "t" },
    });
  });
  it("no credentials when a key is missing", () => {
    expect(awsConfigFromEnv({ AWS_ACCESS_KEY_ID: "a" }).credentials).toBeUndefined();
  });
});

describe("encodePathSegment", () => {
  it("encodes per RFC 3986, including / % and sub-delims", async () => {
    const { encodePathSegment } = await import("../client");
    expect(encodePathSegment("a b/c%d,e'(x)*!")).toBe("a%20b%2Fc%25d%2Ce%27%28x%29%2A%21");
  });
  it.each(["", ".", ".."])("rejects %j with InvalidPathSegment", async (v) => {
    const { encodePathSegment } = await import("../client");
    expect(() => encodePathSegment(v)).toThrowError(expect.objectContaining({ code: "InvalidPathSegment" }));
  });
});
