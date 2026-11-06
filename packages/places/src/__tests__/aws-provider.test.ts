import { describe, it, expect, vi } from "vitest";
import { awsPlaceProvider } from "../aws-provider";
import { runProviderConformance, UPSTREAM_FAILURE_QUERY, UPSTREAM_SUCCESS_QUERY } from "./provider-conformance";

const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };

type Handler = (req: Request) => Response | Promise<Response>;

function setup(handler: Handler | unknown, config: { credentials?: typeof credentials | null; region?: string } = {}) {
  const calls: { req: Request; body: unknown }[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    const req = input as Request;
    const text = await req.clone().text();
    calls.push({ req, body: text ? JSON.parse(text) : undefined });
    return typeof handler === "function" ? (handler as Handler)(req) : Response.json(handler);
  });
  const provider = awsPlaceProvider({
    region: config.region ?? "us-east-1",
    credentials: config.credentials === null ? undefined : (config.credentials ?? credentials),
    fetch: fetchFn as unknown as typeof fetch,
  });
  return { provider, calls, fetchFn };
}

const errRes = (status: number, code: string) =>
  new Response(JSON.stringify({ __type: code, message: code }), { status, headers: { "content-type": "application/json" } });

describe("awsPlaceProvider requests", () => {
  it("suggest POSTs /v2/autocomplete with no AdditionalFeatures or IntendedUse — Label bucket", async () => {
    const s = setup({ ResultItems: [{ PlaceId: "p1", Title: "3315 Danforth Ave" }] });
    await s.provider.suggest("danfor");
    const { req, body } = s.calls[0];
    expect(req.method).toBe("POST");
    expect(new URL(req.url).host).toBe("places.geo.us-east-1.amazonaws.com");
    expect(new URL(req.url).pathname).toBe("/v2/autocomplete");
    expect(body).toEqual({ QueryText: "danfor" });
  });

  it("suggest sends BiasPosition as [lng, lat] and IncludeCountries", async () => {
    const s = setup({ ResultItems: [] });
    await s.provider.suggest("x", { near: { lat: 43.7, lng: -79.3 }, country: "CA" });
    expect(s.calls[0].body).toEqual({ QueryText: "x", BiasPosition: [-79.3, 43.7], Filter: { IncludeCountries: ["CA"] } });
  });

  it("suggest returns [] for blank query without fetching", async () => {
    const s = setup({ ResultItems: [] });
    expect(await s.provider.suggest("  ")).toEqual([]);
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("suggest drops items without PlaceId", async () => {
    const s = setup({ ResultItems: [{ Title: "no id" }, { PlaceId: "p2", Title: "ok" }] });
    expect(await s.provider.suggest("x")).toEqual([{ placeId: "p2", label: "ok" }]);
  });

  it("suggest returns [] on 403", async () => {
    const s = setup(() => errRes(403, "AccessDeniedException"));
    expect(await s.provider.suggest("x")).toEqual([]);
  });

  it("suggest and resolve return []/null without credentials, never fetching", async () => {
    const s = setup({ ResultItems: [] }, { credentials: null });
    expect(await s.provider.suggest("x")).toEqual([]);
    expect(await s.provider.resolve({ address: "x", persist: false })).toBeNull();
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("returns []/null without a region, never fetching", async () => {
    const prev = process.env.AWS_REGION;
    delete process.env.AWS_REGION;
    try {
      const fetchFn = vi.fn();
      const p = awsPlaceProvider({ credentials, fetch: fetchFn as unknown as typeof fetch });
      expect(await p.suggest("x")).toEqual([]);
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env.AWS_REGION = prev;
    }
  });

  it("resolve(placeId, persist:true) GETs /v2/place/<encoded id>?intended-use=Storage", async () => {
    const s = setup({ Position: [-79.3, 43.7], Address: { Label: "L" } });
    await s.provider.resolve({ placeId: "a/b c=", address: "x", persist: true });
    const url = new URL(s.calls[0].req.url);
    expect(s.calls[0].req.method).toBe("GET");
    expect(url.pathname).toBe("/v2/place/a%2Fb%20c%3D");
    expect(url.searchParams.get("intended-use")).toBe("Storage");
  });

  it("resolve returns null without fetching for a dot-segment placeId", async () => {
    const s = setup({});
    await expect(s.provider.resolve({ placeId: "..", address: "x", persist: false })).resolves.toBeNull();
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("resolve(placeId, persist:false) omits intended-use", async () => {
    const s = setup({ Position: [-79.3, 43.7], Address: { Label: "L" } });
    await s.provider.resolve({ placeId: "p1", address: "x", persist: false });
    expect(new URL(s.calls[0].req.url).search).toBe("");
  });

  it("resolve(address) POSTs /v2/geocode, IntendedUse only when persisting", async () => {
    const s = setup({ ResultItems: [{ Position: [-79.3, 43.7], Address: { Label: "L" } }] });
    const r = await s.provider.resolve({ address: "3315 Danforth Ave", persist: true });
    await s.provider.resolve({ address: "3315 Danforth Ave", persist: false });
    expect(new URL(s.calls[0].req.url).pathname).toBe("/v2/geocode");
    expect(s.calls[0].body).toEqual({ QueryText: "3315 Danforth Ave", IntendedUse: "Storage" });
    expect(s.calls[1].body).toEqual({ QueryText: "3315 Danforth Ave" });
    expect(r).toEqual({ lat: 43.7, lng: -79.3, formattedAddress: "L" });
  });

  it("resolve returns null on 500 after retrying", async () => {
    const s = setup(() => errRes(500, "InternalServerException"));
    expect(await s.provider.resolve({ address: "x", persist: false })).toBeNull();
  });

  it("suggest makes 1 attempt, resolve makes 3, on 500s", async () => {
    const a = setup(() => errRes(500, "InternalServerException"));
    await a.provider.suggest("x");
    expect(a.fetchFn).toHaveBeenCalledTimes(1);
    const b = setup(() => errRes(500, "InternalServerException"));
    await b.provider.resolve({ address: "x", persist: false });
    expect(b.fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe("awsPlaceProvider mapping and coordinate order", () => {
  it("suggest prefers Address.Label over Title", async () => {
    // Real AWS shape: Title is ordered least-specific first, which reads badly
    // in a dropdown; Address.Label is the customer-facing string and arrives
    // in the same (cheap) response.
    const f = setup({
      ResultItems: [
        {
          PlaceId: "p1",
          Title: "Canada, ON, M1L 1B8, Toronto, Oakridge, 3315 Danforth Ave",
          Address: { Label: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada" },
        },
      ],
    });
    const p = f.provider;
    expect(await p.suggest("danfor")).toEqual([
      { placeId: "p1", label: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada" },
    ]);
  });

  it("suggest falls back to Title when Address is absent", async () => {
    const f = setup({ ResultItems: [{ PlaceId: "p1", Title: "3315 Danforth Ave" }] });
    const p = f.provider;
    expect(await p.suggest("danfor")).toEqual([{ placeId: "p1", label: "3315 Danforth Ave" }]);
  });

  it("suggest returns [] when there are no results", async () => {
    const f = setup({ ResultItems: [] });
    const p = f.provider;
    expect(await p.suggest("nowhere")).toEqual([]);
  });

  it("suggest returns [] on a malformed response instead of throwing", async () => {
    const p = setup({}).provider;
    expect(await p.suggest("x")).toEqual([]);
  });

  it("suggest returns [] when the client rejects instead of throwing", async () => {
    const p = setup(() => { throw new Error("network"); }).provider;
    await expect(p.suggest("x")).resolves.toEqual([]);
  });

  it("resolve maps Position [lng, lat] to { lat, lng } without transposing", async () => {
    // AWS returns [-79.3872, 43.6853] for a spot in Toronto; lat must stay ~43.68, not ~-79.
    const f = setup({ ResultItems: [{ Position: [-79.3872, 43.6853], Address: { Label: "Toronto, ON" } }] });
    const p = f.provider;
    const result = await p.resolve({ address: "Toronto, ON", persist: false });
    expect(result).toEqual({ lat: 43.6853, lng: -79.3872, formattedAddress: "Toronto, ON" });
  });

  it("resolve populates structured address fields from Address", async () => {
    const f = setup({
      ResultItems: [
        {
          Position: [-79.3872, 43.6853],
          Address: {
            Label: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada",
            AddressNumber: "3315",
            Street: "Danforth Ave",
            Locality: "Scarborough",
            Region: { Code: "ON", Name: "Ontario" },
            PostalCode: "M1L 1B8",
          },
        },
      ],
    });
    const p = f.provider;
    const result = await p.resolve({ address: "3315 Danforth Ave", persist: false });
    expect(result).toEqual({
      lat: 43.6853,
      lng: -79.3872,
      formattedAddress: "3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada",
      addressLine: "3315 Danforth Ave",
      city: "Scarborough",
      province: "ON",
      postalCode: "M1L 1B8",
    });
  });

  it("resolve prefers Region.Name when Region.Code is absent", async () => {
    const f = setup({
      ResultItems: [
        { Position: [-79.3872, 43.6853], Address: { Label: "Toronto, ON", Region: { Name: "Ontario" } } },
      ],
    });
    const p = f.provider;
    const result = await p.resolve({ address: "Toronto, ON", persist: false });
    expect(result?.province).toBe("Ontario");
  });

  it("resolve omits addressLine entirely when AddressNumber or Street is missing, rather than emitting a partial string", async () => {
    const f = setup({
      ResultItems: [{ Position: [-79.3872, 43.6853], Address: { Label: "Danforth Ave, Scarborough, ON", Street: "Danforth Ave" } }],
    });
    const p = f.provider;
    const result = await p.resolve({ address: "Danforth Ave", persist: false });
    expect(result?.addressLine).toBeUndefined();
  });

  it("resolve returns null when there are no results", async () => {
    const f = setup({ ResultItems: [] });
    const p = f.provider;
    expect(await p.resolve({ address: "nowhere", persist: false })).toBeNull();
  });

  it("resolve returns null on a malformed response instead of throwing", async () => {
    const p = setup({}).provider;
    expect(await p.resolve({ address: "x", persist: false })).toBeNull();
  });

  it("resolve returns null when the client rejects instead of throwing", async () => {
    const p = setup(() => { throw new Error("network"); }).provider;
    await expect(p.resolve({ address: "x", persist: false })).resolves.toBeNull();
  });

  it("suggest never calls the client for a whitespace-only query — the empty-input guard", async () => {
    const f = setup({ ResultItems: [{ PlaceId: "p1", Title: "should not be reached" }] });
    const p = f.provider;
    expect(await p.suggest("   ")).toEqual([]);
    expect(f.fetchFn).not.toHaveBeenCalled();
  });

  it("resolve never calls the client for a whitespace-only address with no placeId — the empty-input guard", async () => {
    const f = setup({ ResultItems: [{ Position: [-79.3, 43.7], Address: { Label: "should not be reached" } }] });
    const p = f.provider;
    expect(await p.resolve({ address: "   ", persist: false })).toBeNull();
    expect(f.fetchFn).not.toHaveBeenCalled();
  });
});

let conformanceFetch: ReturnType<typeof vi.fn>;

function makeConformanceProvider() {
  const s = setup(async (req: Request) => {
    const url = new URL(req.url);
    const q = req.method === "POST" ? ((await req.clone().json()) as { QueryText?: string }).QueryText : undefined;
    if (q === UPSTREAM_FAILURE_QUERY) throw new Error("network down");
    if (url.pathname === "/v2/autocomplete") return Response.json({ ResultItems: [{ PlaceId: "p1", Title: UPSTREAM_SUCCESS_QUERY }] });
    return Response.json({ ResultItems: [{ Position: [-79.3872, 43.6853], Address: { Label: UPSTREAM_SUCCESS_QUERY } }] });
  });
  conformanceFetch = s.fetchFn;
  return s.provider;
}

runProviderConformance("aws", makeConformanceProvider, () => conformanceFetch.mock.calls.length);
