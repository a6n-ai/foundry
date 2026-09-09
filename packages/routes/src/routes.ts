import type { BaseService, UpdatableService } from "@foundry/database";
import type { PgTable } from "drizzle-orm/pg-core";
import { parseListParams, type Query } from "./query";
import { toResponse } from "./error-mapper";
import { json, noContent, problem } from "./response";

// Structural rather than importing zod's type: any schema with a `safeParse`
// shaped like this works (zod v3/v4, or a hand-rolled validator), without
// making this package depend on zod.
export interface Validator<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

type AnyBase = BaseService<PgTable>;
type AnyUpdatable = UpdatableService<PgTable>;

export interface RouteOptions {
  guard?: (req: Request) => Promise<void>;
}

const runGuard = async (opts: RouteOptions | undefined, req: Request) => {
  if (opts?.guard) await opts.guard(req);
};

// Wrap a hand-written route handler so thrown AppErrors (e.g. from auth guards)
// surface as problem+json instead of an unhandled 500 — the same try/catch the
// route factories apply. Preserves Next's (req, ctx) arguments.
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return toResponse(e);
    }
  };
}

export function createCollectionRoute(service: AnyBase, opts?: RouteOptions) {
  return {
    async GET(req: Request) {
      try {
        await runGuard(opts, req);
        const page = parseListParams(new URL(req.url));
        return json(await service.list(undefined, page));
      } catch (e) { return toResponse(e); }
    },
    async POST(req: Request) {
      try {
        await runGuard(opts, req);
        const body = (await req.json()) as Record<string, unknown>;
        return json(await service.create(body), 201);
      } catch (e) { return toResponse(e); }
    },
  };
}

export function createQueryRoute(service: AnyBase, opts?: RouteOptions) {
  return {
    async POST(req: Request) {
      try {
        await runGuard(opts, req);
        const q = (await req.json()) as Query;
        const page = { page: q.page ?? 0, size: q.size ?? 10, sort: q.sort };
        return json(await service.list(q.condition, page));
      } catch (e) { return toResponse(e); }
    },
  };
}

type Ctx = { params: Promise<{ id: string }> };

export function createResourceRoute(service: AnyUpdatable, opts?: RouteOptions) {
  return {
    async GET(req: Request, ctx: Ctx) {
      try {
        await runGuard(opts, req);
        const { id } = await ctx.params;
        return json(await service.read(id));
      } catch (e) { return toResponse(e); }
    },
    async PUT(req: Request, ctx: Ctx) {
      try {
        await runGuard(opts, req);
        const { id } = await ctx.params;
        const body = (await req.json()) as Record<string, unknown>;
        return json(await service.update(id, body));
      } catch (e) { return toResponse(e); }
    },
    async PATCH(req: Request, ctx: Ctx) {
      try {
        await runGuard(opts, req);
        const { id } = await ctx.params;
        const body = (await req.json()) as Record<string, unknown>;
        return json(await service.update(id, body));
      } catch (e) { return toResponse(e); }
    },
    async DELETE(req: Request, ctx: Ctx) {
      try {
        await runGuard(opts, req);
        const { id } = await ctx.params;
        await service.delete(id);
        return noContent();
      } catch (e) { return toResponse(e); }
    },
  };
}

/**
 * A one-off (not full-CRUD) POST route keyed on the resource's [id]: guard,
 * parse + validate the JSON body, hand (id, body) to fn, and map the result —
 * a thrown AppError, a returned `{ error, status }` (the shape service
 * functions that can fail for reasons short of an exception tend to return),
 * or plain data to JSON. Generalizes the hand-rolled version of this that
 * every "add related records to a resource" route ends up writing.
 */
export function createValidatedIdRoute<TBody, TResult>(
  schema: Validator<TBody>,
  fn: (id: string, body: TBody) => Promise<TResult | { error: string; status: number }>,
  opts?: RouteOptions,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      await runGuard(opts, req);
      const { id } = await ctx.params;
      const parsed = schema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return problem(400, parsed.error.issues[0]?.message ?? "Invalid request");
      const result = await fn(id, parsed.data);
      if (result && typeof result === "object" && "error" in result && "status" in result) {
        const { error, status } = result as { error: string; status: number };
        return problem(status, error);
      }
      return json(result);
    } catch (e) {
      return toResponse(e);
    }
  };
}
