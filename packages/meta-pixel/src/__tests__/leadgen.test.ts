import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeMetaLeadId,
  parseLeadgenWebhook,
  verifyLeadgenChallenge,
  verifyLeadgenSignature,
} from "../leadgen";

describe("meta leadgen", () => {
  it("normalizes 15–17 digit lead ids", () => {
    expect(normalizeMetaLeadId("1234567890123456")).toBe("1234567890123456");
    expect(normalizeMetaLeadId(1234567890123456)).toBe("1234567890123456");
    expect(normalizeMetaLeadId("abc")).toBeNull();
    expect(normalizeMetaLeadId("123")).toBeNull();
  });

  it("verifies webhook challenge", () => {
    expect(
      verifyLeadgenChallenge({
        mode: "subscribe",
        verifyToken: "secret",
        challenge: "12345",
        expectedVerifyToken: "secret",
      }),
    ).toBe("12345");
    expect(
      verifyLeadgenChallenge({
        mode: "subscribe",
        verifyToken: "wrong",
        challenge: "12345",
        expectedVerifyToken: "secret",
      }),
    ).toBeNull();
  });

  it("verifies X-Hub-Signature-256", () => {
    const body = '{"object":"page"}';
    const secret = "app-secret";
    const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyLeadgenSignature(body, `sha256=${hex}`, secret)).toBe(true);
    expect(verifyLeadgenSignature(body, `sha256=deadbeef`, secret)).toBe(false);
    expect(verifyLeadgenSignature(body, null, null)).toBe(true);
  });

  it("parses leadgen webhook entries", () => {
    const entries = parseLeadgenWebhook({
      object: "page",
      entry: [
        {
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "1234567890123456",
                page_id: "99",
                form_id: "88",
                created_time: 1_700_000_000,
              },
            },
          ],
        },
      ],
    });
    expect(entries).toEqual([
      {
        leadgenId: "1234567890123456",
        pageId: "99",
        formId: "88",
        createdTime: 1_700_000_000,
      },
    ]);
    expect(parseLeadgenWebhook({ object: "user" })).toEqual([]);
  });
});
