import { AppError } from "./errors";

/** `ok?: never` lets `if ("error" in r)` / `if (r.ok)` narrow a result union without casts. */
export type Failure = { ok?: never; error: string; status: number } & Record<string, unknown>;
export type Refusal = { ok: false; code: string; status: number };

export type BoundaryOptions = {
  /** Sets the response status, e.g. TanStack's setResponseStatus. Not called by `result`, whose caller owns the response. */
  setStatus?: (status: number) => void;
  /** Sees every failure once: `sent` is the very error the client gets (thrown by run/read/refuse), `cause` the original. */
  onFailure?: (sent: Error, status: number, cause: unknown) => void;
  /** Errors the framework uses for control flow (e.g. Next's NEXT_REDIRECT) pass through untouched. */
  rethrow?: (err: unknown) => boolean;
  /** Extra fields (or a replacement `error` copy) for a known AppError in `result`, e.g. a rule id the UI highlights. */
  details?: (err: AppError) => Partial<Failure>;
  /** What the client sees for an unexpected error. */
  internalMessage?: string;
};

export type GuardOptions<Need, Actor> = BoundaryOptions & {
  /** Resolves the signed-in actor for one call and checks `need`; throws an AppError (401/403/...) to refuse. */
  actor: (need: Need) => Promise<Actor>;
};

/**
 * Where a server entry point meets its client: an AppError keeps its status and message, anything else
 * becomes `internalMessage` so internals never leak. Use it directly when the caller authorizes inside `fn`.
 */
export function createBoundary(opts: BoundaryOptions = {}) {
  const { setStatus, onFailure, rethrow, details, internalMessage = "internal error" } = opts;

  function describe(err: unknown): Failure {
    if (rethrow?.(err)) throw err;
    return err instanceof AppError
      ? { error: err.message, status: err.status, ...details?.(err) }
      : { error: internalMessage, status: 500 };
  }

  function fail(err: unknown): never {
    const { error, status } = describe(err);
    const sent = new Error(error);
    setStatus?.(status);
    onFailure?.(sent, status, err);
    throw sent;
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      return fail(err);
    }
  }

  /** A read the caller may not make is null, so a page can render its denied state instead of an error. */
  async function read<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AppError && err.status === 403) return null;
      return fail(err);
    }
  }

  /** Expected refusals (`expected` statuses, default 401/403) come back as data the UI can show; anything else fails. */
  async function refuse<T>(fn: () => Promise<T>, expected: readonly number[] = [401, 403]): Promise<T | Refusal> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AppError && expected.includes(err.status)) return { ok: false, code: err.message, status: err.status };
      return fail(err);
    }
  }

  /** Never throws (except `rethrow`): for boundaries that redact thrown errors, like Next server actions. */
  async function result<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | Failure> {
    try {
      return { ok: true, value: await fn() };
    } catch (err) {
      const out = describe(err);
      onFailure?.(new Error(out.error), out.status, err);
      return out;
    }
  }

  return { run, read, refuse, result, fail };
}

/** A boundary that first resolves the actor for `need`; the actor's refusal is mapped like any other AppError. */
export function createGuard<Need, Actor>({ actor, ...opts }: GuardOptions<Need, Actor>) {
  const b = createBoundary(opts);
  const bind = <T>(need: Need, fn: (actor: Actor) => Promise<T>) => async () => fn(await actor(need));
  return {
    run: <T>(need: Need, fn: (actor: Actor) => Promise<T>) => b.run(bind(need, fn)),
    read: <T>(need: Need, fn: (actor: Actor) => Promise<T>) => b.read(bind(need, fn)),
    refuse: <T>(need: Need, fn: (actor: Actor) => Promise<T>, expected?: readonly number[]) => b.refuse(bind(need, fn), expected),
    result: <T>(need: Need, fn: (actor: Actor) => Promise<T>) => b.result(bind(need, fn)),
    fail: b.fail,
  };
}
