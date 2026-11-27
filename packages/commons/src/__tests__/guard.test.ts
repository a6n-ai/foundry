import { describe, expect, it } from "vitest";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { createGuard } from "../guard";

type Need = { role?: string };

function setup() {
  const statuses: number[] = [];
  const failures: { sent: string; status: number; cause: unknown }[] = [];
  const guard = createGuard<Need, { id: string }>({
    actor: async (need) => {
      if (need.role === "admin") throw new ForbiddenError("forbidden");
      if (need.role === "nobody") throw new AppError("unauthorized", 401);
      return { id: "u1" };
    },
    setStatus: (s) => statuses.push(s),
    onFailure: (sent, status, cause) => failures.push({ sent: sent.message, status, cause }),
  });
  return { guard, statuses, failures };
}

describe("createGuard", () => {
  it("runs with the resolved actor", async () => {
    const { guard } = setup();
    await expect(guard.run({}, async (a) => a.id)).resolves.toBe("u1");
  });

  it("keeps an AppError's status and message", async () => {
    const { guard, statuses, failures } = setup();
    await expect(guard.run({}, async () => { throw new NotFoundError("not found"); })).rejects.toThrow("not found");
    expect(statuses).toEqual([404]);
    expect(failures[0]).toMatchObject({ sent: "not found", status: 404 });
  });

  it("hides anything else behind a 500 and passes the real cause to onFailure", async () => {
    const { guard, statuses, failures } = setup();
    const boom = new Error("db password is hunter2");
    await expect(guard.run({}, async () => { throw boom; })).rejects.toThrow(/^internal error$/);
    expect(statuses).toEqual([500]);
    expect(failures[0]).toEqual({ sent: "internal error", status: 500, cause: boom });
  });

  it("read turns a 403 into null without setting a status", async () => {
    const { guard, statuses } = setup();
    await expect(guard.read({ role: "admin" }, async () => "secret")).resolves.toBeNull();
    expect(statuses).toEqual([]);
  });

  it("read still fails on a 401", async () => {
    const { guard, statuses } = setup();
    await expect(guard.read({ role: "nobody" }, async () => "x")).rejects.toThrow("unauthorized");
    expect(statuses).toEqual([401]);
  });

  it("refuse returns 401 and 403 as a code and fails on the rest", async () => {
    const { guard } = setup();
    await expect(guard.refuse({ role: "admin" }, async () => "x")).resolves.toEqual({ ok: false, code: "forbidden", status: 403 });
    await expect(guard.refuse({ role: "nobody" }, async () => "x")).resolves.toEqual({ ok: false, code: "unauthorized", status: 401 });
    await expect(guard.refuse({}, async () => { throw new AppError("taken", 409); })).rejects.toThrow("taken");
  });

  it("passes onFailure the same object it throws", async () => {
    let seen: Error | undefined;
    const guard = createGuard<Need, null>({ actor: async () => null, onFailure: (sent) => { seen = sent; } });
    const thrown = await guard.run({}, async () => { throw new NotFoundError("not found"); }).catch((e: Error) => e);
    expect(thrown).toBe(seen);
  });

  it("result returns failures as data, with details and a custom internal message", async () => {
    class RuleError extends AppError { constructor(readonly ruleId: string) { super("rule broken", 422); } }
    const logged: number[] = [];
    const guard = createGuard<Need, null>({
      actor: async () => null,
      details: (e) => (e instanceof RuleError ? { ruleId: e.ruleId } : {}),
      internalMessage: "Try again.",
      onFailure: (_s, status) => logged.push(status),
    });
    await expect(guard.result({}, async () => 7)).resolves.toEqual({ ok: true, value: 7 });
    await expect(guard.result({}, async () => { throw new RuleError("r1"); })).resolves.toEqual({ error: "rule broken", status: 422, ruleId: "r1" });
    await expect(guard.result({}, async () => { throw new Error("db down"); })).resolves.toEqual({ error: "Try again.", status: 500 });
    expect(logged).toEqual([422, 500]);
  });

  it("rethrows control-flow errors untouched", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/x" });
    const guard = createGuard<Need, null>({ actor: async () => null, rethrow: (e) => e === redirect });
    await expect(guard.result({}, async () => { throw redirect; })).rejects.toBe(redirect);
    await expect(guard.run({}, async () => { throw redirect; })).rejects.toBe(redirect);
  });

  it("refuse returns whichever statuses the caller expects", async () => {
    const { guard, statuses } = setup();
    const taken = () => guard.refuse({}, async () => { throw new AppError("taken", 409); }, [400, 404, 409]);
    await expect(taken()).resolves.toEqual({ ok: false, code: "taken", status: 409 });
    expect(statuses).toEqual([]);
  });
});
