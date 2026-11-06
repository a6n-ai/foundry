import { describe, it, expect, vi } from "vitest";
import { AwsError } from "@foundry/cloud";
import { awsMapProvider } from "../aws-provider";

const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };

function setup(res: () => Response, opts: { style?: "Standard"; colorScheme?: "Light" | "Dark" } = {}) {
  const calls: Request[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(input as Request);
    return res();
  });
  const provider = awsMapProvider({ region: "us-east-1", credentials, fetch: fetchFn as unknown as typeof fetch, ...opts });
  return { provider, calls };
}

const ok = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/x-test" } });

describe("awsMapProvider", () => {
  it("style GETs the descriptor with color-scheme", async () => {
    const s = setup(ok);
    const out = await s.provider.style();
    const u = new URL(s.calls[0].url);
    expect(s.calls[0].method).toBe("GET");
    expect(u.host).toBe("maps.geo.us-east-1.amazonaws.com");
    expect(u.pathname).toBe("/v2/styles/Standard/descriptor");
    expect(u.searchParams.get("color-scheme")).toBe("Light");
    expect(Array.from(out.bytes)).toEqual([1, 2, 3]);
    expect(out.contentType).toBe("application/x-test");
    expect(s.calls[0].headers.get("authorization")).toContain("/geo-maps/aws4_request");
  });

  it("honours colorScheme", async () => {
    const s = setup(ok, { colorScheme: "Dark" });
    await s.provider.style();
    expect(new URL(s.calls[0].url).searchParams.get("color-scheme")).toBe("Dark");
  });

  it("tile GETs /v2/tiles/vector.basemap/z/x/y", async () => {
    const s = setup(ok);
    await s.provider.tile("3", "4", "5");
    expect(new URL(s.calls[0].url).pathname).toBe("/v2/tiles/vector.basemap/3/4/5");
  });

  it("sprite GETs the Standard/Light/Default sprite path", async () => {
    const s = setup(ok);
    await s.provider.sprite("sprites@2x.png");
    expect(new URL(s.calls[0].url).pathname).toBe("/v2/styles/Standard/Light/Default/sprites/sprites%402x.png");
  });

  it("glyphs encodes the font stack exactly once", async () => {
    const s = setup(ok);
    await s.provider.glyphs("Amazon Ember Regular,Noto Sans", "0-255.pbf");
    const u = new URL(s.calls[0].url);
    expect(u.pathname).toBe("/v2/glyphs/Amazon%20Ember%20Regular%2CNoto%20Sans/0-255.pbf");
  });

  it("contentType is undefined when the header is absent", async () => {
    const s = setup(() => new Response(new Uint8Array([9])));
    expect((await s.provider.tile("0", "0", "0")).contentType).toBeUndefined();
  });

  it("rejects AwsError on non-2xx", async () => {
    const s = setup(() => new Response(JSON.stringify({ message: "nope" }), { status: 403, headers: { "x-amzn-errortype": "AccessDeniedException" } }));
    await expect(s.provider.tile("0", "0", "0")).rejects.toBeInstanceOf(AwsError);
  });

  it("retries once on 5xx", async () => {
    let n = 0;
    const s = setup(() => (n++ === 0 ? new Response("", { status: 503 }) : ok()));
    await s.provider.tile("0", "0", "0");
    expect(s.calls).toHaveLength(2);
  });

  it.each([
    ["glyphs ..", (p: ReturnType<typeof awsMapProvider>) => p.glyphs("..", "0-255.pbf")],
    ["tile ..", (p: ReturnType<typeof awsMapProvider>) => p.tile("..", "0", "0")],
    ["sprite ..", (p: ReturnType<typeof awsMapProvider>) => p.sprite("..")],
    ["z format", (p: ReturnType<typeof awsMapProvider>) => p.tile("123", "0", "0")],
    ["x format", (p: ReturnType<typeof awsMapProvider>) => p.tile("1", "a", "0")],
    ["y format", (p: ReturnType<typeof awsMapProvider>) => p.tile("1", "0", "12345678")],
    ["range format", (p: ReturnType<typeof awsMapProvider>) => p.glyphs("Noto Sans Regular", "0-255.png")],
    ["sprite format", (p: ReturnType<typeof awsMapProvider>) => p.sprite("evil.png")],
    ["tile empty", (p: ReturnType<typeof awsMapProvider>) => p.tile("", "0", "0")],
  ])("rejects dot/empty segment (%s) without fetching", async (_n, call) => {
    const s = setup(ok);
    await expect(call(s.provider)).rejects.toMatchObject({ code: "InvalidPathSegment" });
    expect(s.calls).toHaveLength(0);
  });
});
