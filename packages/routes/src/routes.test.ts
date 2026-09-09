import { AuthError } from "@foundry/commons";
import { describe, expect, it, vi } from "vitest";
import { createValidatedIdRoute, handler, type Validator } from "./routes";

const nameSchema: Validator<{ name: string }> = {
  safeParse: (input) =>
    input && typeof input === "object" && typeof (input as { name?: unknown }).name === "string"
      ? { success: true, data: input as { name: string } }
      : { success: false, error: { issues: [{ message: "name is required" }] } },
};

describe("handler", () => {
  it("passes a returned Response through untouched", async () => {
    const GET = handler(async () => new Response("ok", { status: 200 }));
    expect((await GET()).status).toBe(200);
  });

  it("maps a thrown AppError to problem+json", async () => {
    const GET = handler(async () => {
      throw new AuthError();
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect((await res.json()).detail).toBe("Unauthorized");
  });
});

const ctx = { params: Promise.resolve({ id: "lst_1" }) };
const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("createValidatedIdRoute", () => {
  it("rejects an invalid body before calling fn", async () => {
    const fn = vi.fn();
    const POST = createValidatedIdRoute(nameSchema, fn);
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a returned {error,status} to problem+json", async () => {
    const POST = createValidatedIdRoute(nameSchema, async () => ({ error: "not found", status: 404 }));
    const res = await POST(req({ name: "a" }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toBe("not found");
  });

  it("passes the resolved id and parsed body to fn, returns its result as json", async () => {
    const fn = vi.fn(async (id: string, body: { name: string }) => ({ id, echoed: body.name }));
    const POST = createValidatedIdRoute(nameSchema, fn);
    const res = await POST(req({ name: "Ada" }), ctx);
    expect(fn).toHaveBeenCalledWith("lst_1", { name: "Ada" });
    expect(await res.json()).toEqual({ id: "lst_1", echoed: "Ada" });
  });
});
