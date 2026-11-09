import { encodePathSegment, rfc3986 } from "./client";

export interface HmacUrlSignerOptions {
  secret: string;
  baseUrl: string;
  /** Query parameter carrying the token; must match the separator length passed to the WAF rule. Default "verify". */
  paramName?: string;
  now?: () => number;
}

/**
 * Signs URLs for Cloudflare WAF `is_timed_hmac_valid_v0(secret, http.request.uri, ttl, http.request.timestamp.sec, len("?verify="))`.
 * Token = `<issue-time-sec>-<urlencoded base64 HMAC-SHA256(secret, pathAndQuery + issueTimeSec)>`, appended last in the query.
 * `ttlSeconds` is advisory only: the token carries the issue time and the WAF rule's TTL decides expiry, so the rule's TTL must match what callers pass.
 * Takes raw key segments and encodes them itself, then checks the parsed URL still has exactly the intended path, so what is signed is what is served.
 * Docs: https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/
 */
export function hmacUrlSigner(opts: HmacUrlSignerOptions) {
  const param = opts.paramName ?? "verify";
  const now = opts.now ?? Date.now;
  const base = opts.baseUrl.replace(/\/+$/, "");
  const key = crypto.subtle.importKey("raw", new TextEncoder().encode(opts.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  return {
    async sign(segments: string[], _ttlSeconds: number, query?: Record<string, string>): Promise<string> {
      // Rejected explicitly although encodePathSegment would encode them: callers passing these almost certainly built a path by hand.
      if (segments.some((s) => /[\\#\u0000-\u001f\u007f]/.test(s))) throw new Error(`Unsafe path segment in ${JSON.stringify(segments)}`);
      const basePath = new URL(base).pathname.replace(/\/+$/, "");
      const expectedPath = `${basePath}/${segments.map(encodePathSegment).join("/")}`;
      const qs = Object.entries(query ?? {}).map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).join("&");
      const url = new URL(`${base}${expectedPath.slice(basePath.length)}${qs ? `?${qs}` : ""}`);
      if (url.pathname !== expectedPath || !url.pathname.startsWith(`${basePath}/`)) throw new Error(`Signed path differs from intended path: ${JSON.stringify(segments)}`);
      const ts = Math.floor(now() / 1000);
      const message = url.pathname + url.search + ts;
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await key, new TextEncoder().encode(message)));
      const b64 = btoa(String.fromCharCode(...mac));
      return `${url.origin}${url.pathname}${url.search}${url.search ? "&" : "?"}${param}=${ts}-${encodeURIComponent(b64)}`;
    },
  };
}
