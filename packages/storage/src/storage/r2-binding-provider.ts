import { AwsError } from "@foundry/cloud";
import { encodeKey } from "./keys";
import type { GetResult, HeadResult, ListOptions, ListResult, PutOptions, PutResult, StorageProvider } from "./types";

/** Structural subset of Cloudflare's R2Bucket, so no workers-types dependency. */
export interface R2BucketLike {
  put(key: string, value: Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string }; size: number } | null>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string }; uploaded: Date } | null>;
  list(options?: { prefix?: string; delimiter?: string; limit?: number; cursor?: string }): Promise<{
    objects: { key: string }[];
    delimitedPrefixes: string[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(key: string): Promise<void>;
}

export interface R2BindingStorageConfig {
  bucket: R2BucketLike;
  /** Signs raw (unencoded) key segments into a readable URL, e.g. hmacUrlSigner from @foundry/cloud. */
  signer?: { sign(segments: string[], ttlSeconds: number): Promise<string> };
}

/** Workers R2 binding; reads are shared via signed URLs (Cloudflare WAF token validation), uploads must go through put. */
export class R2BindingStorageProvider implements StorageProvider {
  readonly name = "r2-binding";
  private readonly bucket: R2BucketLike;
  private readonly signer?: R2BindingStorageConfig["signer"];

  constructor(config: R2BindingStorageConfig) {
    this.bucket = config.bucket;
    this.signer = config.signer;
  }

  async put(key: string, body: Uint8Array | string, opts?: PutOptions): Promise<PutResult> {
    encodeKey(key);
    await this.bucket.put(key, body, opts?.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
    return { key, size: typeof body === "string" ? new TextEncoder().encode(body).byteLength : body.byteLength };
  }

  async get(key: string): Promise<GetResult> {
    encodeKey(key);
    const obj = await this.bucket.get(key);
    // Same shape S3StorageProvider surfaces for a 404 (AwsError status 404).
    if (!obj) throw new AwsError("NoSuchKey", `The specified key does not exist: ${key}`, { status: 404 });
    const body = new Uint8Array(await obj.arrayBuffer());
    return { body, contentType: obj.httpMetadata?.contentType, size: body.byteLength };
  }

  async head(key: string): Promise<HeadResult | null> {
    encodeKey(key);
    const obj = await this.bucket.head(key);
    return obj && { size: obj.size, contentType: obj.httpMetadata?.contentType, lastModified: obj.uploaded.getTime() };
  }

  async list(prefix: string, opts?: ListOptions): Promise<ListResult> {
    const res = await this.bucket.list({ prefix, delimiter: opts?.delimiter, limit: opts?.maxKeys, cursor: opts?.token });
    return {
      keys: res.objects.map((o) => o.key),
      commonPrefixes: res.delimitedPrefixes,
      isTruncated: res.truncated,
      nextToken: res.truncated ? res.cursor : undefined,
    };
  }

  async delete(key: string): Promise<void> {
    encodeKey(key);
    await this.bucket.delete(key);
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    encodeKey(fromKey);
    encodeKey(toKey);
    const src = await this.get(fromKey);
    await this.put(toKey, src.body, { contentType: src.contentType });
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    encodeKey(key);
    if (!this.signer) throw new Error("presignGet requires a signer (configure R2BindingStorageProvider with a signer)");
    return this.signer.sign(key.split("/"), ttlSeconds);
  }

  async presignPut(_key: string, _ttlSeconds: number, _opts?: PutOptions): Promise<string> {
    throw new Error("presignPut is not supported by R2BindingStorageProvider");
  }
}
