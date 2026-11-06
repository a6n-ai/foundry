export { createAwsClient, awsConfigFromEnv, encodePathSegment } from "./client";
export type { AwsConfig, AwsCredentials, AwsRequestOptions } from "./client";
export { AwsError, parseAwsError } from "./errors";
export { hmacUrlSigner } from "./hmac-url";
export type { HmacUrlSignerOptions } from "./hmac-url";
