import { describe, expect, it } from "vitest";
import { withCronAuth } from "./cron-auth";

const req = (authorization?: string) => new Request("http://x/api/cron/y", { headers: authorization ? { authorization } : {} });
const wrap = (secret: string | undefined) => withCronAuth(() => secret)(async () => Response.json({ ran: true }));

describe("withCronAuth", () => {
  it("rejects when no secret is configured", async () => {
    expect((await wrap("")(req("Bearer "))).status).toBe(401);
    expect((await wrap(undefined)(req("Bearer undefined"))).status).toBe(401);
  });

  it("rejects a missing, wrong or different-length bearer", async () => {
    const ok = wrap("s3cret");
    for (const h of [undefined, "Bearer nope!!", "Bearer s3cre", "s3cret"]) expect((await ok(req(h))).status).toBe(401);
  });

  it("runs the handler on the right bearer", async () => {
    const res = await wrap("s3cret")(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ran: true });
  });
});
