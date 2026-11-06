import { AwsError, encodePathSegment, awsConfigFromEnv, createAwsClient, type AwsConfig } from "@foundry/cloud";
import { createLogger } from "@foundry/commons/logger";
import type { PlaceProvider, PlaceSuggestion, ResolvedPlace } from "./types";

const log = createLogger("places-aws");

export interface AwsPlaceProviderOptions extends AwsConfig {}

interface Address {
  Label?: string;
  AddressNumber?: string;
  Street?: string;
  Locality?: string;
  Region?: { Code?: string; Name?: string };
  PostalCode?: string;
}
interface PlaceItem { PlaceId?: string; Title?: string; Position?: number[]; Address?: Address }
interface PlacesResponse { ResultItems?: PlaceItem[] }

// Fires on every keystroke of a debounced typeahead — the user has often already
// typed past this request by the time a retry would land, so fail fast rather
// than tripling cost/latency on stale input.
const SUGGEST_BUDGET = { retries: 0, timeoutMs: 3_000 };
// Runs once per order — worth a retry budget, with a longer timeout since
// checkout can afford to wait slightly longer than a keystroke.
const RESOLVE_BUDGET = { retries: 2, timeoutMs: 8_000 };

/** AWS Position is [longitude, latitude] — GeoJSON order, not { lat, lng }. */
function toResolvedPlace(position: readonly number[] | undefined, address: Address | undefined): ResolvedPlace | null {
  const label = address?.Label;
  if (!position || position.length < 2 || !label) return null;
  const [lng, lat] = position;
  const addressLine = address?.AddressNumber && address?.Street ? `${address.AddressNumber} ${address.Street}` : undefined;
  const city = address?.Locality;
  const province = address?.Region?.Code ?? address?.Region?.Name;
  const postalCode = address?.PostalCode;
  return { lat, lng, formattedAddress: label, addressLine, city, province, postalCode };
}

// A silent catch here is a silent outage: resolvePlace() falls through to
// Nominatim on any miss, so a bad IAM policy or wrong region would otherwise
// degrade every request with nothing to notice — no throw, no failed build, the
// AWS bill just stays at zero forever. Logging code + HTTP status is enough to
// diagnose auth vs. throttling vs. network without changing the never-throw contract.
function logAwsError(operation: string, e: unknown) {
  const err = e as (Partial<AwsError> & { name?: string; message?: string }) | undefined;
  // "errorName" (not "name") — pino already binds "name" to the logger name above;
  // reusing the key would silently shadow it in the JSON output.
  log.error(
    { errorName: err instanceof AwsError ? err.code : err?.name, status: err?.status, err: err?.message ?? e },
    `${operation} request failed`,
  );
}

export function awsPlaceProvider(opts: AwsPlaceProviderOptions = {}): PlaceProvider {
  const env = awsConfigFromEnv();
  const client = createAwsClient("geo-places", {
    region: opts.region ?? env.region,
    credentials: opts.credentials ?? env.credentials,
    fetch: opts.fetch,
  });
  // client.region throws MissingRegion, so this must be called inside each try.
  const base = () => `https://places.geo.${client.region}.amazonaws.com`;

  return {
    id: "aws",

    async suggest(query, suggestOpts) {
      if (!query.trim()) return [];
      try {
        // No AdditionalFeatures, no IntendedUse — this is the $0.20/1k Label bucket.
        const out = await client.json<PlacesResponse>(`${base()}/v2/autocomplete`, {
          method: "POST",
          json: {
            QueryText: query,
            BiasPosition: suggestOpts?.near ? [suggestOpts.near.lng, suggestOpts.near.lat] : undefined,
            Filter: suggestOpts?.country ? { IncludeCountries: [suggestOpts.country] } : undefined,
          },
          ...SUGGEST_BUDGET,
        });
        const suggestions: PlaceSuggestion[] = [];
        for (const item of out?.ResultItems ?? []) {
          // Address.Label, not Title. Title is ordered least-specific first
          // ("Canada, ON, M1L 1B8, Toronto, Oakridge, 3315 Danforth Ave"),
          // which puts the street at the end of every row in the dropdown.
          // Address.Label reads the way a customer expects
          // ("3315 Danforth Ave, Scarborough, ON M1L 1B8, Canada") and is
          // returned by default — no AdditionalFeatures, so this stays in the
          // cheap Label bucket rather than moving to Core.
          const label = item.Address?.Label ?? item.Title;
          if (item.PlaceId && label) suggestions.push({ placeId: item.PlaceId, label });
        }
        return suggestions;
      } catch (e) {
        logAwsError("autocomplete", e);
        return [];
      }
    },

    async resolve({ placeId, address, persist }) {
      if (!placeId && !address.trim()) return null;

      // "Storage" is the API's actual enum value for the Stored/persistable bucket
      // (the brief called it "Stored"; the API names it "Storage").
      const intendedUse = persist ? "Storage" : undefined;
      try {
        if (placeId) {
          const out = await client.json<PlaceItem>(`${base()}/v2/place/${encodePathSegment(placeId)}`, {
            query: { "intended-use": intendedUse },
            ...RESOLVE_BUDGET,
          });
          return toResolvedPlace(out?.Position, out?.Address);
        }
        const out = await client.json<PlacesResponse>(`${base()}/v2/geocode`, {
          method: "POST",
          json: { QueryText: address, IntendedUse: intendedUse },
          ...RESOLVE_BUDGET,
        });
        const item = out?.ResultItems?.[0];
        if (!item) return null;
        return toResolvedPlace(item.Position, item.Address);
      } catch (e) {
        logAwsError(placeId ? "get-place" : "geocode", e);
        return null;
      }
    },
  };
}
