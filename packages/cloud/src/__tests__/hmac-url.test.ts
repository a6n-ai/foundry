import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacUrlSigner } from "../index";

const secret = "s3cret";
const now = () => 1_700_000_000_123;
const ts = 1_700_000_000;
const expected = (msg: string) => `${ts}-${encodeURIComponent(createHmac("sha256", secret).update(msg + ts).digest("base64"))}`;
const signer = hmacUrlSigner({ secret, baseUrl: "https://files.example.com/", now });

describe("hmacUrlSigner", () => {
  it("signs path + timestamp like Cloudflare expects", async () => {
    expect(await signer.sign(["a", "b.txt"], 60)).toBe(`https://files.example.com/a/b.txt?verify=${expected("/a/b.txt")}`);
  });

  it("encodes space, ü and + in segments", async () => {
    const path = "/dir/my%20file%20%C3%BC%2Bx.png";
    expect(await signer.sign(["dir", "my file ü+x.png"], 60)).toBe(`https://files.example.com${path}?verify=${expected(path)}`);
  });

  it("signs an encoded query and appends with &", async () => {
    expect(await signer.sign(["a"], 60, { x: "1 2", y: "ü" })).toBe(`https://files.example.com/a?x=1%202&y=%C3%BC&verify=${expected("/a?x=1%202&y=%C3%BC")}`);
  });

  it("keeps a baseUrl path prefix in the signed uri", async () => {
    const s = hmacUrlSigner({ secret, baseUrl: "https://h/files", now });
    expect(await s.sign(["a"], 1)).toBe(`https://h/files/a?verify=${expected("/files/a")}`);
  });

  it("honors paramName", async () => {
    const s = hmacUrlSigner({ secret, baseUrl: "https://h", paramName: "tok", now });
    expect(await s.sign(["a"], 1)).toContain("/a?tok=");
  });

  it.each([["#"], ["\\"], ["a\nb"], ["a\u0000b"], [""], ["."], [".."]])("rejects segment %j", async (seg) => {
    await expect(signer.sign(["ok", seg], 60)).rejects.toThrow();
  });

  it("rejects an empty segment from a//b", async () => {
    await expect(signer.sign("a//b".split("/"), 60)).rejects.toThrow();
  });
});
