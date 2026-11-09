import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readBody, readJson } from "./http";

const post = (body: string) => new Request("http://x", { method: "POST", body });

describe("readBody / readJson", () => {
  it("reads JSON and falls back on a malformed body", async () => {
    expect(await readBody(post('{"a":1}'))).toEqual({ a: 1 });
    expect(await readBody(post("nope"), {})).toEqual({});
  });
  it("safeParses the body against the schema", async () => {
    const schema = z.object({ a: z.number() });
    expect((await readJson(post('{"a":1}'), schema)).success).toBe(true);
    expect((await readJson(post("nope"), schema)).success).toBe(false);
  });
});
