import { describe, expect, it } from "vitest";
import { parseListObjectsV2 } from "./s3-xml";

describe("parseListObjectsV2", () => {
  it("decodes entities, prefixes, truncation", () => {
    const r = parseListObjectsV2(
      `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>tok&amp;1</NextContinuationToken>` +
        `<Contents><Key>a&amp;b&lt;c&gt;&quot;&apos;.txt</Key><Size>1</Size></Contents><Contents><Key>x</Key></Contents>` +
        `<CommonPrefixes><Prefix>dir/</Prefix></CommonPrefixes></ListBucketResult>`,
    );
    expect(r).toEqual({ keys: [`a&b<c>"'.txt`, "x"], commonPrefixes: ["dir/"], isTruncated: true, nextToken: "tok&1" });
  });

  it("handles empty results", () => {
    expect(parseListObjectsV2(`<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>`)).toEqual({
      keys: [], commonPrefixes: [], isTruncated: false, nextToken: undefined,
    });
  });
});
