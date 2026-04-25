import { CliError } from "./errors";
import type { AvailabilityRecord, Cabin, RawAvailabilityTrip, SearchResponse, SearchStats, Trip } from "./types";

const BASE_URL = "https://seats.aero/partnerapi/search";

type SearchQuery = {
  from: string;
  to: string;
  date: string;
  dateEnd: string;

  direct: boolean;
  includeFiltered: boolean;
  includeTrips?: boolean;
  minifyTrips?: boolean;
  sources?: string[];
  carriers?: string[];
};

type SearchOptions = {
  fetchImpl?: typeof fetch;
  maxPages?: number;
};

type SearchResult = {
  records: AvailabilityRecord[];
  stats: SearchStats;
  warnings: string[];
};

function buildUrl(query: SearchQuery, cursor?: number): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("origin_airport", query.from);
  url.searchParams.set("destination_airport", query.to);
  url.searchParams.set("start_date", query.date);
  url.searchParams.set("end_date", query.dateEnd);
  url.searchParams.set("take", "1000");
  if (query.sources && query.sources.length > 0) {
    url.searchParams.set("sources", query.sources.join(","));
  }
  if (query.carriers && query.carriers.length > 0) {
    url.searchParams.set("carriers", query.carriers.join(","));
  }

  if (query.direct) {
    url.searchParams.set("only_direct_flights", "true");
  }
  if (query.includeFiltered) {
    url.searchParams.set("include_filtered", "true");
  }
  if (query.includeTrips) {
    url.searchParams.set("include_trips", "true");
  }
  if (query.minifyTrips) {
    url.searchParams.set("minify_trips", "true");
  }
  if (typeof cursor === "number") {
    url.searchParams.set("cursor", String(cursor));
  }
  return url.toString();
}

function parseApiError(text: string, status: number): CliError {
  const trimmed = text.trim();
  if (trimmed === "missing_partner_key") {
    return new CliError("Missing API key. Run `seats setup` or set SEATS_AERO_API_KEY.", 3);
  }
  if (trimmed === "bad_partner_key") {
    return new CliError("Invalid API key. Update key with `seats setup`.", 3);
  }
  return new CliError(`Partner API error (${status}): ${trimmed || "unknown error"}`, 3);
}

export async function searchFlights(
  apiKey: string,
  query: SearchQuery,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = options.maxPages ?? 50;
  const warnings: string[] = [];
  const records: AvailabilityRecord[] = [];
  let fetchedPages = 0;
  let fetchedRecords = 0;
  let cursor: number | undefined;
  let hasMore = true;
  let truncated = false;

  while (hasMore) {
    if (fetchedPages >= maxPages) {
      truncated = true;
      warnings.push(`Result set truncated after ${maxPages} pages.`);
      break;
    }

    const url = buildUrl(query, cursor);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          "Partner-Authorization": apiKey
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Network error: ${message}`, 3);
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw parseApiError(bodyText, response.status);
    }

    let parsed: SearchResponse;
    try {
      parsed = JSON.parse(bodyText) as SearchResponse;
    } catch {
      throw new CliError("Partner API returned invalid JSON.", 3);
    }

    const pageData = Array.isArray(parsed.data) ? parsed.data : [];
    records.push(...pageData);
    fetchedPages += 1;
    fetchedRecords += pageData.length;
    hasMore = parsed.hasMore === true;
    cursor = typeof parsed.cursor === "number" ? parsed.cursor : undefined;
    if (hasMore && typeof cursor !== "number") {
      warnings.push("API reported more results but no cursor was provided. Stopping early.");
      hasMore = false;
    }
  }

  return {
    records,
    stats: {
      fetchedPages,
      fetchedRecords,
      truncated
    },
    warnings
  };
}

const CABIN_NORMALIZE: Record<string, Cabin> = {
  economy: "economy",
  premium: "premium",
  business: "business",
  first: "first"
};

export async function fetchTrips(
  apiKey: string,
  availabilityId: string,
  options?: { cabin?: Cabin; fetchImpl?: typeof fetch }
): Promise<Trip[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `https://seats.aero/partnerapi/trips/${availabilityId}?include_filtered=true`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "Partner-Authorization": apiKey }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Network error fetching trips: ${message}`, 3);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw parseApiError(bodyText, response.status);
  }

  let parsed: { data?: RawAvailabilityTrip[] };
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new CliError("Trips API returned invalid JSON.", 3);
  }

  const raw = Array.isArray(parsed.data) ? parsed.data : [];
  const trips: Trip[] = [];

  for (const t of raw) {
    const cabin = CABIN_NORMALIZE[t.Cabin ?? ""];
    if (!cabin) continue;
    if (options?.cabin && cabin !== options.cabin) continue;
    if (typeof t.MileageCost !== "number" || t.MileageCost <= 0) continue;

    trips.push({
      cabin,
      miles: t.MileageCost,
      flights: t.FlightNumbers ?? "",
      connections: t.Connections ?? [],
      stops: t.Stops ?? 0,
      departsAt: t.DepartsAt ?? "",
      arrivesAt: t.ArrivesAt ?? "",
      totalDuration: t.TotalDuration ?? 0,
      aircraft: t.Aircraft ?? [],
      seats: t.RemainingSeats ?? 0
    });
  }

  trips.sort((a, b) => a.miles - b.miles || a.totalDuration - b.totalDuration);
  return trips;
}
