import { createAwsClient } from "@foundry/aws";
import { parseListObjectsV2 } from "./s3-xml";
import type {
  GetResult,
  HeadResult,
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  StorageProvider,
} from "./types";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Set for R2/MinIO/Backblaze; omit for AWS S3. */
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  /** Required true for MinIO and most non-AWS endpoints. */
  forcePathStyle?: boolean;
  fetch?: typeof fetch;
}

const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
// Reject, don't encode: aws4fetch decodes the path before signing, so %2E%2E would turn back into "..".
const encodeKey = (key: string) =>
  key
    .split("/")
    .map((seg) => {
      if (seg === "" || seg === "." || seg === "..") throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
      return rfc3986(seg);
    })
    .join("/");
const OPTS = { retries: 1, timeoutMs: 10_000 };

/** One signed S3 client pointed at any S3-compatible endpoint. */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly aws: ReturnType<typeof createAwsClient>;
  private readonly bucket: string;
  private readonly base: string;
  private readonly basePath: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.aws = createAwsClient("s3", { region: config.region, credentials: config.credentials, fetch: config.fetch });
    if (!config.endpoint) this.base = `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
    else if (config.forcePathStyle) this.base = `${config.endpoint.replace(/\/+$/, "")}/${config.bucket}`;
    else {
      const e = new URL(config.endpoint);
      this.base = `${e.protocol}//${config.bucket}.${e.host}`;
    }
    this.basePath = new URL(this.base).pathname.replace(/\/+$/, "") + "/";
  }

  private url(key: string) {
    const url = `${this.base}/${encodeKey(key)}`;
    if (!new URL(url).pathname.startsWith(this.basePath)) throw new Error(`Storage key escapes bucket path: ${JSON.stringify(key)}`);
    return url;
  }

  async put(key: string, body: Uint8Array | string, opts?: PutOptions): Promise<PutResult> {
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    const res = await this.aws.request(this.url(key), {
      ...OPTS,
      method: "PUT",
      body: bytes as BodyInit,
      headers: opts?.contentType ? { "content-type": opts.contentType } : undefined,
    });
    return { key, etag: res.headers.get("etag") ?? undefined, size: bytes.byteLength };
  }

  async get(key: string): Promise<GetResult> {
    const res = await this.aws.request(this.url(key), OPTS);
    const body = new Uint8Array(await res.arrayBuffer());
    return { body, contentType: res.headers.get("content-type") ?? undefined, size: body.byteLength };
  }

  async head(key: string): Promise<HeadResult | null> {
    try {
      const res = await this.aws.request(this.url(key), { ...OPTS, method: "HEAD" });
      const lm = res.headers.get("last-modified");
      return {
        size: Number(res.headers.get("content-length") ?? 0),
        contentType: res.headers.get("content-type") ?? undefined,
        lastModified: lm ? Date.parse(lm) : undefined,
      };
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<ListResult> {
    const res = await this.aws.request(`${this.base}/`, {
      ...OPTS,
      query: {
        "list-type": "2",
        prefix,
        delimiter: opts?.delimiter,
        "max-keys": opts?.maxKeys?.toString(),
        "continuation-token": opts?.token,
      },
    });
    return parseListObjectsV2(await res.text());
  }

  async delete(key: string): Promise<void> {
    await this.aws.request(this.url(key), { ...OPTS, method: "DELETE" });
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    await this.aws.request(this.url(toKey), {
      ...OPTS,
      method: "PUT",
      headers: { "x-amz-copy-source": `/${this.bucket}/${encodeKey(fromKey)}` },
    });
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    return this.aws.presign(this.url(key), { expiresIn: ttlSeconds });
  }

  // contentType is not signed: the uploader may send any Content-Type.
  async presignPut(key: string, ttlSeconds: number, _opts?: PutOptions): Promise<string> {
    return this.aws.presign(this.url(key), { method: "PUT", expiresIn: ttlSeconds });
  }
}
