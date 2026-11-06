import { AwsClient } from "aws4fetch";
import { AwsError, parseAwsError } from "./errors";

export interface AwsCredentials { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
export interface AwsConfig { region?: string; credentials?: AwsCredentials; fetch?: typeof fetch }
export interface AwsRequestOptions {
  method?: string;
  query?: Record<string, string | undefined>;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  retries: number;
  timeoutMs: number;
}

export function awsConfigFromEnv(env: Record<string, string | undefined> = process.env): AwsConfig {
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey, AWS_SESSION_TOKEN: sessionToken, AWS_REGION: region } = env;
  return {
    region: region || undefined,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } : undefined,
  };
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function withQuery(url: string, query?: AwsRequestOptions["query"]): string {
  const qs = Object.entries(query ?? {})
    .filter((e): e is [string, string] => e[1] !== undefined)
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join("&");
  if (!qs) return url;
  return url + (url.includes("?") ? "&" : "?") + qs;
}

const retryable = (status: number) => status === 429 || status >= 500;

export function createAwsClient(service: string, config: AwsConfig = {}) {
  const doFetch = config.fetch ?? fetch;
  const getRegion = () => {
    if (!config.region) throw new AwsError("MissingRegion", "AWS region is not configured (set AWS_REGION)");
    return config.region;
  };
  const signer = () => {
    const c = config.credentials;
    if (!c) throw new AwsError("MissingCredentials", "AWS credentials are not configured (set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)");
    return new AwsClient({ ...c, service, region: getRegion(), retries: 0 });
  };

  async function request(url: string, opts: AwsRequestOptions): Promise<Response> {
    const signerClient = signer();
    const target = withQuery(url, opts.query);
    const headers = { ...(opts.json !== undefined ? { "content-type": "application/json" } : {}), ...opts.headers };
    const body = opts.json !== undefined ? JSON.stringify(opts.json) : opts.body;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        const signed = await signerClient.sign(target, { method: opts.method ?? (body === undefined ? "GET" : "POST"), headers, body });
        res = await doFetch(signed, { signal: AbortSignal.timeout(opts.timeoutMs) });
      } catch (e) {
        if (attempt < opts.retries && !(e instanceof AwsError)) { await backoff(attempt); continue; }
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AwsError("Timeout", `Request timed out after ${opts.timeoutMs}ms`);
        throw e;
      }
      if (res.ok) return res;
      if (attempt < opts.retries && retryable(res.status)) { await res.body?.cancel(); await backoff(attempt); continue; }
      throw await parseAwsError(res);
    }
  }

  return {
    get region() { return getRegion(); },
    request,
    async json<T>(url: string, opts: AwsRequestOptions): Promise<T> {
      const text = await (await request(url, opts)).text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
    async presign(url: string, opts: { method?: string; expiresIn: number }): Promise<string> {
      const u = new URL(url);
      u.searchParams.set("X-Amz-Expires", String(opts.expiresIn));
      const signed = await signer().sign(u.toString(), { method: opts.method ?? "GET", aws: { signQuery: true } });
      return signed.url;
    },
  };
}

const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.random() * 50 * 2 ** attempt));
