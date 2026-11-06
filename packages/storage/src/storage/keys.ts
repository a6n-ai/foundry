const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Rejects empty/"."/".." segments (so also leading "/") and returns the RFC 3986 encoded key path. Reject, don't encode: aws4fetch decodes the path before signing, so %2E%2E would turn back into "..". */
export function encodeKey(key: string): string {
  return key
    .split("/")
    .map((seg) => {
      if (seg === "" || seg === "." || seg === "..") throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
      return rfc3986(seg);
    })
    .join("/");
}
