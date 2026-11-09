import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@foundry/database";
import { createStorageFromEnv, type StorageFromEnvOptions } from "./from-env";
import type { R2BucketLike } from "./storage/r2-binding-provider";

const make = (getR2Binding: StorageFromEnvOptions["getR2Binding"] = () => undefined) =>
  createStorageFromEnv({
    db: {} as Database,
    filesPublicBaseUrl: () => "https://files.example.test",
    isProduction: () => process.env.NODE_ENV === "production",
    signedBaseUrl: "https://files.example.test",
    getR2Binding,
  }).makeStorage();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("makeStorage", () => {
  it("uses S3 with no static credentials, so the SDK falls back to the instance role", () => {
    vi.stubEnv("FILES_S3_BUCKET", "prod-files");
    vi.stubEnv("FILES_S3_REGION", "us-east-1");
    vi.stubEnv("FILES_S3_ACCESS_KEY_ID", "");
    vi.stubEnv("FILES_S3_SECRET_ACCESS_KEY", "");
    expect(make().name).toBe("s3");
  });

  it("still accepts static credentials (MinIO/R2 dev)", () => {
    vi.stubEnv("FILES_S3_BUCKET", "dev");
    vi.stubEnv("FILES_S3_ENDPOINT", "http://localhost:9000");
    vi.stubEnv("FILES_S3_ACCESS_KEY_ID", "minio");
    vi.stubEnv("FILES_S3_SECRET_ACCESS_KEY", "minio123");
    expect(make().name).toBe("s3");
  });

  it("refuses to fall back to local disk in production", () => {
    vi.stubEnv("FILES_S3_BUCKET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => make()).toThrow(/refusing to store files on ephemeral container disk/);
  });

  it("falls back to local disk outside production", () => {
    vi.stubEnv("FILES_S3_BUCKET", "");
    expect(make().name).toBe("local");
  });
});

describe("makeStorage R2 binding selection", () => {
  const bucket = {};
  const binding = (env: unknown) => () => {
    if (env === undefined) throw new Error("outside a request");
    return (env as { FILES?: R2BucketLike }).FILES;
  };

  it("uses the R2 binding when FILES and the signing secret are both present", () => {
    vi.stubEnv("FILES_URL_SIGNING_SECRET", "s3cret");
    vi.stubEnv("FILES_S3_BUCKET", "b");
    expect(make(binding({ FILES: bucket })).name).toBe("r2-binding");
  });

  it("falls back to S3 without the secret", () => {
    vi.stubEnv("FILES_URL_SIGNING_SECRET", "");
    vi.stubEnv("FILES_S3_BUCKET", "b");
    expect(make(binding({ FILES: bucket })).name).toBe("s3");
  });

  it("falls back to S3 without the binding, or outside a Worker request", () => {
    vi.stubEnv("FILES_URL_SIGNING_SECRET", "s3cret");
    vi.stubEnv("FILES_S3_BUCKET", "b");
    expect(make(binding({})).name).toBe("s3");
    expect(make(binding(undefined)).name).toBe("s3");
  });
});
