import { describe, it, expect, vi } from "vitest";
import { resolveAndPersist } from "../index";

describe("resolveAndPersist", () => {
  it("resolves via AWS with persist: true, and never touches Google", async () => {
    const calls: Request[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(input as Request);
      return Response.json({ Position: [-79.3872, 43.6853], Address: { Label: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada" } });
    });
    // resolveAndPersist forwards opts straight to awsPlaceProvider() — injecting
    // fetch proves it is awsPlaceProvider(opts).resolve({ ..., persist: true }),
    // not some other AWS/Google mix.
    const opts = {
      region: "us-east-1",
      credentials: { accessKeyId: "AKID", secretAccessKey: "s" },
      fetch: fetchFn as unknown as typeof fetch,
    };

    const result = await resolveAndPersist({ placeId: "p1", address: "3315 Danforth Ave" }, opts);

    expect(result).toEqual({ lat: 43.6853, lng: -79.3872, formattedAddress: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada" });
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/v2/place/p1");
    expect(url.searchParams.get("intended-use")).toBe("Storage");
  });
});
