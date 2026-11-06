import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@foundry/commons";
import { SesEmailProvider } from "./ses-provider";

const defaultFrom = { email: "noreply@tiffingrab.ca", name: "Tiffin Grab" };
const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };

function fakeFetch(body: unknown = { MessageId: "ses-1" }) {
  const sent: { url: string; method: string; json: Record<string, any> }[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    const req = input as Request;
    const text = await req.clone().text();
    sent.push({ url: req.url, method: req.method, json: text ? JSON.parse(text) : undefined });
    return Response.json(body);
  });
  return { fetchFn, sent };
}

const envKeys = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION"] as const;
const saved = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of envKeys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("SesEmailProvider", () => {
  it("POSTs a SESv2 outbound email and returns the MessageId", async () => {
    const { fetchFn, sent } = fakeFetch();
    const p = new SesEmailProvider({
      defaultFrom,
      region: "us-east-1",
      credentials,
      fetch: fetchFn as unknown as typeof fetch,
      configurationSetName: "tg-events",
    });

    const res = await p.send({
      to: { email: "cust@example.com", name: "Cust" },
      subject: "Order confirmed",
      html: "<p>hi</p>",
    });

    expect(res).toEqual({ providerMessageId: "ses-1", provider: "ses" });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(new URL(sent[0].url).host).toBe("email.us-east-1.amazonaws.com");
    expect(new URL(sent[0].url).pathname).toBe("/v2/email/outbound-emails");
    expect(sent[0].json).toEqual({
      FromEmailAddress: "Tiffin Grab <noreply@tiffingrab.ca>",
      Destination: { ToAddresses: ["Cust <cust@example.com>"] },
      ConfigurationSetName: "tg-events",
      Content: {
        Simple: {
          Subject: { Data: "Order confirmed", Charset: "UTF-8" },
          Body: { Html: { Data: "<p>hi</p>", Charset: "UTF-8" } },
        },
      },
    });
  });

  it("throws AppError 502 when SES returns no MessageId", async () => {
    const { fetchFn } = fakeFetch({});
    const p = new SesEmailProvider({
      defaultFrom,
      region: "us-east-1",
      credentials,
      fetch: fetchFn as unknown as typeof fetch,
    });
    const err = await p.send({ to: { email: "a@b.com" }, subject: "x", text: "y" }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(502);
  });

  it("throws AppError and never fetches when credentials are missing", async () => {
    for (const k of envKeys) delete process.env[k];
    const { fetchFn } = fakeFetch();
    const p = new SesEmailProvider({
      defaultFrom,
      region: "us-east-1",
      fetch: fetchFn as unknown as typeof fetch,
    });
    await expect(p.send({ to: { email: "a@b.com" }, subject: "x", text: "y" })).rejects.toBeInstanceOf(AppError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
