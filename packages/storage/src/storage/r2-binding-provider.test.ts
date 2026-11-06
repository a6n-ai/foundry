import { describe, expect, it, vi } from "vitest";
import { R2BindingStorageProvider, type R2BucketLike } from "./r2-binding-provider";

function fakeBucket() {
  const m = new Map<string, { data: Uint8Array; contentType?: string; uploaded: Date }>();
  const bucket: R2BucketLike = {
    put: vi.fn(async (key, value, o) => {
      m.set(key, { data: typeof value === "string" ? new TextEncoder().encode(value) : value, contentType: o?.httpMetadata?.contentType, uploaded: new Date(5000) });
    }),
    get: vi.fn(async (key) => {
      const e = m.get(key);
      return e ? { arrayBuffer: async () => e.data.slice().buffer as ArrayBuffer, httpMetadata: { contentType: e.contentType }, size: e.data.byteLength } : null;
    }),
    head: vi.fn(async (key) => {
      const e = m.get(key);
      return e ? { size: e.data.byteLength, httpMetadata: { contentType: e.contentType }, uploaded: e.uploaded } : null;
    }),
    list: vi.fn(async ({ prefix = "", delimiter, limit = 1000, cursor } = {}) => {
      const prefixes = new Set<string>();
      const keys: string[] = [];
      for (const k of [...m.keys()].sort().filter((k) => k.startsWith(prefix))) {
        const i = delimiter ? k.indexOf(delimiter, prefix.length) : -1;
        if (i >= 0) prefixes.add(k.slice(0, i + delimiter!.length));
        else keys.push(k);
      }
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map((key) => ({ key })), delimitedPrefixes: [...prefixes], truncated, cursor: truncated ? String(start + limit) : undefined };
    }),
    delete: vi.fn(async (key) => void m.delete(key)),
  };
  return bucket;
}

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("R2BindingStorageProvider", () => {
  it("put/get/head round-trip", async () => {
    const s = new R2BindingStorageProvider({ bucket: fakeBucket() });
    expect(await s.put("a/b.txt", "héllo", { contentType: "text/plain" })).toEqual({ key: "a/b.txt", size: 6 });
    expect(await s.head("a/b.txt")).toEqual({ size: 6, contentType: "text/plain", lastModified: 5000 });
    const got = await s.get("a/b.txt");
    expect(dec(got.body)).toBe("héllo");
    expect(got).toMatchObject({ contentType: "text/plain", size: 6 });
  });

  it("missing key: head null, get throws a 404 error like the S3 provider", async () => {
    const s = new R2BindingStorageProvider({ bucket: fakeBucket() });
    expect(await s.head("nope")).toBeNull();
    await expect(s.get("nope")).rejects.toMatchObject({ status: 404, code: "NoSuchKey" });
  });

  it("lists prefixes and paginates", async () => {
    const s = new R2BindingStorageProvider({ bucket: fakeBucket() });
    for (const k of ["d/1", "d/2", "d/3", "d/sub/x", "e/1"]) await s.put(k, "x");
    const p1 = await s.list("d/", { delimiter: "/", maxKeys: 2 });
    expect(p1).toMatchObject({ keys: ["d/1", "d/2"], commonPrefixes: ["d/sub/"], isTruncated: true });
    const p2 = await s.list("d/", { delimiter: "/", maxKeys: 2, token: p1.nextToken });
    expect(p2).toMatchObject({ keys: ["d/3"], isTruncated: false, nextToken: undefined });
  });

  it("deletes", async () => {
    const s = new R2BindingStorageProvider({ bucket: fakeBucket() });
    await s.put("x", "v");
    await s.delete("x");
    expect(await s.head("x")).toBeNull();
  });

  it("copy keeps contentType", async () => {
    const s = new R2BindingStorageProvider({ bucket: fakeBucket() });
    await s.put("x", "v", { contentType: "image/png" });
    await s.copy("x", "y");
    expect(await s.get("y")).toMatchObject({ contentType: "image/png", size: 1 });
    await expect(s.copy("missing", "z")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects unsafe keys without touching the bucket", async () => {
    const bucket = fakeBucket();
    const s = new R2BindingStorageProvider({ bucket });
    for (const k of ["", "/a", "a//b", "a/./b", "../x", "a/.."]) {
      await expect(s.put(k, "v")).rejects.toThrow(/Unsafe/);
      await expect(s.get(k)).rejects.toThrow(/Unsafe/);
      await expect(s.head(k)).rejects.toThrow(/Unsafe/);
      await expect(s.delete(k)).rejects.toThrow(/Unsafe/);
      await expect(s.presignGet(k, 1)).rejects.toThrow(/Unsafe/);
    }
    await expect(s.copy("ok", "../bad")).rejects.toThrow(/Unsafe/);
    for (const fn of Object.values(bucket)) expect(fn).not.toHaveBeenCalled();
  });

  it("presignGet delegates raw segments; throws without signer", async () => {
    const sign = vi.fn(async (p: string[], t: number) => `https://cdn/${p.join("/")}?t=${t}`);
    const s = new R2BindingStorageProvider({ bucket: fakeBucket(), signer: { sign } });
    expect(await s.presignGet("a b/ü+.png", 60)).toBe("https://cdn/a b/ü+.png?t=60");
    expect(sign).toHaveBeenCalledWith(["a b", "ü+.png"], 60);
    await expect(new R2BindingStorageProvider({ bucket: fakeBucket() }).presignGet("a", 1)).rejects.toThrow(/signer/);
  });

  it("presignPut is unsupported", async () => {
    await expect(new R2BindingStorageProvider({ bucket: fakeBucket() }).presignPut("a", 1)).rejects.toThrow("presignPut is not supported by R2BindingStorageProvider");
  });
});
