import { timingSafeEqual } from "node:crypto";

type Handler = (request: Request) => Promise<Response>;

function bearerMatches(authorization: string | null, secret: string): boolean {
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(authorization ?? "");
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Fail closed: no secret configured, or a mismatched bearer, is a 401. Every route under /api/cron (exempt in the app's proxy) must be wrapped. `getSecret` is read per request. */
export function withCronAuth(getSecret: () => string | undefined): (handler: Handler) => Handler {
  return (handler) => async (request) => {
    const secret = getSecret();
    if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request);
  };
}
