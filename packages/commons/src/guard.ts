import { AppError } from "./errors";

export type Failure = { error: string; status: number } & Record<string, unknown>;
export type Refusal = { ok: false; code: string; status: number };

export type GuardOptions<Need, Actor> = {
  /** Resolves the signed-in actor for one call and checks `need`; throws an AppError (401/403/...) to refuse. */
  actor: (need: Need) => Promise<Actor>;
  /** Sets the response status, e.g. TanStack's setResponseStatus. Not called by `result`, whose caller owns the response. */
  setStatus?: (status: number) => void;
  /** Sees every failure once: `sent` is the message the client gets, `cause` the original error. */
  onFailure?: (sent: Error, status: number, cause: unknown) => void;
  /** Errors the framework uses for control flow (e.g. Next's NEXT_REDIRECT) pass through untouched. */
  rethrow?: (err: unknown) => boolean;
  /** Extra fields (or a replacement `error` copy) for a known AppError in `result`, e.g. a rule id the UI highlights. */
  details?: (err: AppError) => Partial<Failure>;
  /** What the client sees for an unexpected error. */
  internalMessage?: string;
};

// The client only ever sees an AppError's message; anything else gets `internalMessage` so internals never leak.
export function createGuard<Need, Actor>(opts: GuardOptions<Need, Actor>) {
  const { actor, setStatus, onFailure, rethrow, details, internalMessage = "internal error" } = opts;

  function describe(err: unknown): Failure {
    if (rethrow?.(err)) throw err;
    return err instanceof AppError
      ? { error: err.message, status: err.status, ...details?.(err) }
      : { error: internalMessage, status: 500 };
  }

  // onFailure gets the very object that is thrown, so an app can key side data (a log cause) on it.
  function fail(err: unknown): never {
    const { error, status } = describe(err);
    const sent = new Error(error);
    setStatus?.(status);
    onFailure?.(sent, status, err);
    throw sent;
  }

  function failure(err: unknown): Failure {
    const out = describe(err);
    onFailure?.(new Error(out.error), out.status, err);
    return out;
  }

  async function run<T>(need: Need, fn: (actor: Actor) => Promise<T>): Promise<T> {
    try {
      return await fn(await actor(need));
    } catch (err) {
      return fail(err);
    }
  }

  /** A read the actor may not make is null, so a page can render its denied state instead of an error. */
  async function read<T>(need: Need, fn: (actor: Actor) => Promise<T>): Promise<T | null> {
    try {
      return await fn(await actor(need));
    } catch (err) {
      if (err instanceof AppError && err.status === 403) return null;
      return fail(err);
    }
  }

  /**
   * Expected refusals come back as data the UI can show; anything else still fails.
   * `expected` lists the statuses the caller's UI handles as a message (default 401/403).
   */
  async function refuse<T>(
    need: Need,
    fn: (actor: Actor) => Promise<T>,
    expected: readonly number[] = [401, 403],
  ): Promise<T | Refusal> {
    try {
      return await fn(await actor(need));
    } catch (err) {
      if (err instanceof AppError && expected.includes(err.status)) return { ok: false, code: err.message, status: err.status };
      return fail(err);
    }
  }

  /** Never throws (except `rethrow`): for boundaries that redact thrown errors, like Next server actions. */
  async function result<T>(need: Need, fn: (actor: Actor) => Promise<T>): Promise<{ ok: true; value: T } | Failure> {
    try {
      return { ok: true, value: await fn(await actor(need)) };
    } catch (err) {
      return failure(err);
    }
  }

  return { run, read, refuse, result, fail };
}
