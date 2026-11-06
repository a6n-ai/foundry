export class AwsError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  constructor(code: string, message: string, extra: { status?: number; requestId?: string } = {}) {
    super(message);
    this.name = "AwsError";
    this.code = code;
    this.status = extra.status;
    this.requestId = extra.requestId;
  }
}

const xml = (body: string, tag: string) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

export async function parseAwsError(res: Response): Promise<AwsError> {
  const status = res.status;
  const text = await res.text().catch(() => "");
  let code: string | undefined;
  let message: string | undefined;
  let requestId = res.headers.get("x-amzn-requestid") ?? res.headers.get("x-amz-request-id") ?? undefined;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const raw = (j.__type ?? j.code ?? j.Code ?? res.headers.get("x-amzn-errortype")) as string | undefined;
    // "ns#Name:http://..." and "Name:http://..." forms both reduce to Name
    code = raw?.split(":")[0]?.split("#").pop();
    message = (j.message ?? j.Message) as string | undefined;
  } catch {
    code = xml(text, "Code");
    message = xml(text, "Message");
    requestId = xml(text, "RequestId") ?? requestId;
  }
  code ||= status === 404 ? "NotFound" : "UnknownError";
  return new AwsError(code, message || text || `${code} (HTTP ${status})`, { status, requestId });
}
