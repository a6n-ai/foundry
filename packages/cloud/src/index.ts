export { createAwsClient, awsConfigFromEnv, encodePathSegment, rfc3986 } from "./client";
export type { AwsConfig, AwsCredentials, AwsRequestOptions } from "./client";
export { AwsError, parseAwsError } from "./errors";
export { hmacUrlSigner } from "./hmac-url";
export type { HmacUrlSignerOptions } from "./hmac-url";
