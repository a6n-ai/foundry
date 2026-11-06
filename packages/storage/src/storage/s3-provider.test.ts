import { describe, expect, it } from "vitest";
import { S3StorageProvider } from "./s3-provider";

const creds = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };

function setup(over: Record<string, unknown> = {}, respond: () => Response = () => new Response("", { status: 200 })) {
  const calls: Request[] = [];
  const fetchFn = (async (input: Request) => {
    calls.push(input);
    return respond();
  }) as unknown as typeof fetch;
  const s = new S3StorageProvider({ bucket: "bkt", region: "us-east-1", credentials: creds, fetch: fetchFn, ...over });
  return { s, calls };
}

const r2 = { region: "auto", endpoint: "https://acct.r2.cloudflarestorage.com", forcePathStyle: true };

describe("S3StorageProvider", () => {
  it("put sends PUT with content-type and returns etag/size", async () => {
    const { s, calls } = setup({}, () => new Response("", { headers: { etag: '"abc"' } }));
    const res = await s.put("k/f.txt", "hello", { contentType: "text/plain" });
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe("https://bkt.s3.us-east-1.amazonaws.com/k/f.txt");
    expect(calls[0]!.headers.get("content-type")).toBe("text/plain");
    expect(res).toEqual({ key: "k/f.txt", etag: '"abc"', size: 5 });
  });

  it("get returns bytes, contentType, size", async () => {
    const { s } = setup({}, () => new Response("hi", { headers: { "content-type": "text/plain" } }));
    const res = await s.get("k");
    expect(new TextDecoder().decode(res.body)).toBe("hi");
    expect(res.contentType).toBe("text/plain");
    expect(res.size).toBe(2);
  });

  it("head maps headers; 404 empty body is null; 403 throws", async () => {
    const lm = "Wed, 21 Oct 2015 07:28:00 GMT";
    const ok = setup({}, () => new Response("", { headers: { "content-length": "7", "content-type": "image/png", "last-modified": lm } }));
    expect(await ok.s.head("k")).toEqual({ size: 7, contentType: "image/png", lastModified: Date.parse(lm) });
    expect(ok.calls[0]!.method).toBe("HEAD");
    expect(await setup({}, () => new Response(null, { status: 404 })).s.head("k")).toBeNull();
    await expect(setup({}, () => new Response(null, { status: 403 })).s.head("k")).rejects.toMatchObject({ status: 403 });
  });

  it("list builds the v2 query and parses the result", async () => {
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>n</NextContinuationToken><Contents><Key>p/a</Key></Contents><CommonPrefixes><Prefix>p/d/</Prefix></CommonPrefixes></ListBucketResult>`;
    const { s, calls } = setup({}, () => new Response(xml));
    const res = await s.list("p/", { delimiter: "/", maxKeys: 5, token: "t" });
    const u = new URL(calls[0]!.url);
    expect(Object.fromEntries(u.searchParams)).toEqual({ "list-type": "2", prefix: "p/", delimiter: "/", "max-keys": "5", "continuation-token": "t" });
    expect(res).toEqual({ keys: ["p/a"], commonPrefixes: ["p/d/"], isTruncated: true, nextToken: "n" });
  });

  it("delete and copy", async () => {
    const { s, calls } = setup();
    await s.delete("k");
    expect(calls[0]!.method).toBe("DELETE");
    await s.copy("a b/ü.png", "to");
    expect(calls[1]!.method).toBe("PUT");
    expect(calls[1]!.url).toBe("https://bkt.s3.us-east-1.amazonaws.com/to");
    expect(calls[1]!.headers.get("x-amz-copy-source")).toBe("/bkt/a%20b/%C3%BC.png");
  });

  it("encodes special keys once and signs", async () => {
    const { s, calls } = setup();
    await s.get("a b/ü+1.png");
    expect(calls[0]!.url).toBe("https://bkt.s3.us-east-1.amazonaws.com/a%20b/%C3%BC%2B1.png");
    expect(calls[0]!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
  });

  it("builds R2 path-style and endpoint virtual-host URLs", async () => {
    const a = setup(r2);
    await a.s.get("x/y");
    expect(a.calls[0]!.url).toBe("https://acct.r2.cloudflarestorage.com/bkt/x/y");
    expect(a.calls[0]!.headers.get("authorization")).toContain("/auto/s3/aws4_request");
    const b = setup({ ...r2, forcePathStyle: false });
    await b.s.get("x/y");
    expect(b.calls[0]!.url).toBe("https://bkt.acct.r2.cloudflarestorage.com/x/y");
  });

  it("presigns get and put with X-Amz-Expires", async () => {
    const { s } = setup();
    for (const url of [await s.presignGet("a b", 900), await s.presignPut("a b", 900, { contentType: "image/png" })]) {
      const u = new URL(url);
      expect(u.searchParams.get("X-Amz-Expires")).toBe("900");
      expect(u.searchParams.get("X-Amz-Signature")).toBeTruthy();
      expect(u.pathname).toBe("/a%20b");
    }
  });
});
