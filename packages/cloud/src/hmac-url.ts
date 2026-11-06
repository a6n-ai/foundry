export interface HmacUrlSignerOptions {
  secret: string;
  baseUrl: string;
  /** Query parameter carrying the token; must match the separator length passed to the WAF rule. Default "verify". */
  paramName?: string;
  /** Clock in ms, injectable for tests. */
  now?: () => number;
}

/**
 * Signs URLs for Cloudflare WAF `is_timed_hmac_valid_v0(secret, http.request.uri, ttl, http.request.timestamp.sec, len("?verify="))`.
 * Token = `<issue-time-sec>-<urlencoded base64 HMAC-SHA256(secret, pathAndQuery + issueTimeSec)>`, appended last in the query.
 * `ttlSeconds` is advisory only: the token carries the issue time and the WAF rule's TTL decides expiry, so the rule's TTL must match what callers pass.
 * `path` must already be percent-encoded (use encodePathSegment per segment); it is signed as given.
 * Docs: https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/
 */
export function hmacUrlSigner(opts: HmacUrlSignerOptions) {
  const param = opts.paramName ?? "verify";
  const now = opts.now ?? Date.now;
  const base = opts.baseUrl.replace(/\/+$/, "");
  const key = crypto.subtle.importKey("raw", new TextEncoder().encode(opts.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  return {
    async sign(path: string, _ttlSeconds: number): Promise<string> {
      const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
      // URL parsing collapses dot segments, which would sign a different path than the caller meant.
      if (path.split("?")[0]!.split("/").some((s) => /^(\.|%2e){1,2}$/i.test(s))) throw new Error(`Unsafe path: ${JSON.stringify(path)}`);
      const ts = Math.floor(now() / 1000);
      const message = url.pathname + url.search + ts;
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await key, new TextEncoder().encode(message)));
      const b64 = btoa(String.fromCharCode(...mac));
      return `${url.origin}${url.pathname}${url.search}${url.search ? "&" : "?"}${param}=${ts}-${encodeURIComponent(b64)}`;
    },
  };
}
