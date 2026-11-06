import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodePathSegment, hmacUrlSigner } from "../index";

const secret = "s3cret";
const now = () => 1_700_000_000_123;
const ts = 1_700_000_000;
const expected = (msg: string) => `${ts}-${encodeURIComponent(createHmac("sha256", secret).update(msg + ts).digest("base64"))}`;
const signer = hmacUrlSigner({ secret, baseUrl: "https://files.example.com/", now });

describe("hmacUrlSigner", () => {
  it("signs path + timestamp like Cloudflare expects", async () => {
    expect(await signer.sign("/a/b.txt", 60)).toBe(`https://files.example.com/a/b.txt?verify=${expected("/a/b.txt")}`);
  });

  it("handles space, ü and + in keys", async () => {
    const path = ["dir", "my file ü+x.png"].map(encodePathSegment).join("/");
    expect(path).toBe("dir/my%20file%20%C3%BC%2Bx.png");
    expect(await signer.sign(path, 60)).toBe(`https://files.example.com/${path}?verify=${expected("/" + path)}`);
  });

  it("appends with & when a query exists and signs the query", async () => {
    expect(await signer.sign("/a?x=1", 60)).toBe(`https://files.example.com/a?x=1&verify=${expected("/a?x=1")}`);
  });

  it("honors paramName", async () => {
    const s = hmacUrlSigner({ secret, baseUrl: "https://h", paramName: "tok", now });
    expect(await s.sign("/a", 1)).toContain("/a?tok=");
  });

  it("rejects dot segments", async () => {
    await expect(signer.sign("a/../b", 60)).rejects.toThrow(/Unsafe/);
    await expect(signer.sign("a/%2e%2E/b", 60)).rejects.toThrow(/Unsafe/);
    expect(() => encodePathSegment("..")).toThrow();
  });
});
