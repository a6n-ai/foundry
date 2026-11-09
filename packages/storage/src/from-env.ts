import { hmacUrlSigner } from "@foundry/cloud";
import type { Database } from "@foundry/database";
import { AccessPathService } from "./services/access-path.service";
import { FileSystemService } from "./services/file-system.service";
import { SecuredAccessService } from "./services/secured-access.service";
import { LocalStorageProvider } from "./storage/local-provider";
import { type R2BucketLike, R2BindingStorageProvider } from "./storage/r2-binding-provider";
import { S3StorageProvider } from "./storage/s3-provider";
import type { StorageProvider } from "./storage/types";

export interface StorageFromEnvOptions {
  db: Database;
  /** Public base for static file URLs (read when the static service is first built). */
  filesPublicBaseUrl: () => string;
  isProduction: () => boolean;
  /** Default host for HMAC-signed R2 URLs; FILES_SIGNED_BASE_URL overrides it. */
  signedBaseUrl: string;
  /** The Worker's FILES R2 binding. Read per call, never cached; a throw (outside a Worker request) means "no binding". */
  getR2Binding: () => R2BucketLike | undefined;
}

// Storage env. If the Worker has the FILES R2 binding AND FILES_URL_SIGNING_SECRET is set, files go
// through the binding with HMAC-signed URLs on FILES_SIGNED_BASE_URL (default: options.signedBaseUrl).
// Otherwise: if FILES_S3_BUCKET is set, use S3 (AWS S3, Cloudflare R2, MinIO, Backblaze); otherwise fall
// back to on-disk LocalStorageProvider so files work before S3 is configured.
//   FILES_URL_SIGNING_SECRET    HMAC secret shared with the files host WAF rule
//   FILES_SIGNED_BASE_URL       overrides options.signedBaseUrl
//   The S3 keys below are only needed for the fallback (no binding or no secret):
//   FILES_S3_BUCKET             set to enable S3 (else local disk is used)
//   FILES_S3_REGION             default "auto"
//   FILES_S3_ENDPOINT           set for R2/MinIO/Backblaze; omit for AWS S3
//   FILES_S3_FORCE_PATH_STYLE   "true" for MinIO / most non-AWS endpoints
//   FILES_S3_ACCESS_KEY_ID      required (no instance-role fallback)
//   FILES_S3_SECRET_ACCESS_KEY  required (no instance-role fallback)
//   FILES_LOCAL_DIR             local-disk base dir (default ".files-storage")
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// Static keys only when both are set. Left undefined, signing is skipped and
// every S3 call fails — there is no instance-role fallback.
function s3Credentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
  const accessKeyId = process.env.FILES_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.FILES_S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey };
}

export function createStorageFromEnv(opts: StorageFromEnvOptions) {
  const { db } = opts;

  function r2Binding(): R2BucketLike | undefined {
    try {
      return opts.getR2Binding();
    } catch {
      return undefined;
    }
  }

  function makeStorage(): StorageProvider {
    const secret = process.env.FILES_URL_SIGNING_SECRET;
    const bucket = secret ? r2Binding() : undefined;
    if (secret && bucket) {
      return new R2BindingStorageProvider({
        bucket,
        signer: hmacUrlSigner({ secret, baseUrl: process.env.FILES_SIGNED_BASE_URL ?? opts.signedBaseUrl }),
      });
    }
    if (process.env.FILES_S3_BUCKET) {
      return new S3StorageProvider({
        bucket: required("FILES_S3_BUCKET"),
        // "auto" is an R2-ism; real S3 signs per-region and 400s on "auto".
        region: process.env.FILES_S3_REGION ?? "auto",
        endpoint: process.env.FILES_S3_ENDPOINT,
        forcePathStyle: process.env.FILES_S3_FORCE_PATH_STYLE === "true",
        credentials: s3Credentials(),
      });
    }
    // A container without a volume for FILES_LOCAL_DIR loses on-disk files on the next deploy while
    // their file_system rows survive: silent 404s, not an error. Fail loudly instead: in prod, S3 is
    // the only correct backend.
    if (opts.isProduction()) {
      throw new Error("FILES_S3_BUCKET is not set — refusing to store files on ephemeral container disk");
    }
    return new LocalStorageProvider(process.env.FILES_LOCAL_DIR ?? ".files-storage");
  }

  // Lazy: storage is only built when first needed, so using filesAccess / filesSecuredAccess
  // (which need no storage) never trips required().
  let cached: FileSystemService | undefined;
  function filesService(): FileSystemService {
    cached ??= new FileSystemService(makeStorage(), db, {
      publicBaseUrl: opts.filesPublicBaseUrl(),
      // Static files live under public/* so the files CDN can be scoped there and never reach
      // secured objects. Existing objects keep their old keys.
      keyPrefix: "public",
    });
    return cached;
  }

  // Secured twin of filesService: rows are resourceType "secured", so reads go through a minted
  // SecuredAccessService token, not a public URL.
  let securedCached: FileSystemService | undefined;
  function securedFilesService(): FileSystemService {
    securedCached ??= new FileSystemService(makeStorage(), db, { resourceType: "secured", signedUrlTtlSeconds: 3600 });
    return securedCached;
  }

  return {
    makeStorage,
    filesService,
    securedFilesService,
    // These need only db — safe to construct eagerly (no S3 env required).
    filesAccess: new AccessPathService(db),
    filesSecuredAccess: new SecuredAccessService(db),
  };
}
