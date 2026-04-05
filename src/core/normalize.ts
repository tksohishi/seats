import { CODE_TO_CABIN } from "./types";
import type { AvailabilityRecord, CabinCode, FlightRow, FlightsArgs } from "./types";

const CABIN_CODES: CabinCode[] = ["F", "J", "W", "Y"];
const CABIN_RANK: Record<string, number> = {
  first: 0,
  business: 1,
  premium: 2,
  economy: 3
};

function getField<T>(record: AvailabilityRecord, key: string): T | undefined {
  return (record as Record<string, T | undefined>)[key];
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return true;
}

function getPreferredField<T>(record: AvailabilityRecord, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = getField<T>(record, key);
    if (hasValue(value)) {
      return value;
    }
  }
  return undefined;
}

function getCabinField<T>(
  record: AvailabilityRecord,
  code: CabinCode,
  field: string,
  useRaw: boolean
): T | undefined {
  const keys = useRaw ? [`${code}${field}Raw`, `${code}${field}`] : [`${code}${field}`];
  return getPreferredField<T>(record, keys);
}

function getCabinMetric<T>(
  record: AvailabilityRecord,
  code: CabinCode,
  field: string,
  options: { useRaw: boolean; directOnly: boolean }
): T | undefined {
  const keys: string[] = [];
  if (options.directOnly) {
    if (options.useRaw) {
      keys.push(`${code}Direct${field}Raw`);
    }
    keys.push(`${code}Direct${field}`);
  }
  if (options.useRaw) {
    keys.push(`${code}${field}Raw`);
  }
  keys.push(`${code}${field}`);
  return getPreferredField<T>(record, keys);
}

function parseMiles(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAirlines(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((airline) => airline.trim())
    .filter((airline) => airline.length > 0);
}

function buildSearchUrl(from: string, to: string, date: string, cabin: string, direct: boolean): string {
  const url = new URL("https://seats.aero/search");
  url.searchParams.set("origins", from);
  url.searchParams.set("destinations", to);
  url.searchParams.set("date", date);
  url.searchParams.set("applicable_cabin", cabin);
  if (direct) {
    url.searchParams.set("direct_only", "true");
  }
  return url.toString();
}

export function normalizeRows(records: AvailabilityRecord[], args: FlightsArgs): FlightRow[] {
  const rows: FlightRow[] = [];
  const dedupe = new Set<string>();

  for (const record of records) {
    const source = record.Source ?? record.Route?.Source ?? "";
    const origin = record.Route?.OriginAirport ?? args.from;
    const destination = record.Route?.DestinationAirport ?? args.to;
    const date = record.Date ?? args.date;
    const availabilityId = record.ID ?? `${source}:${origin}:${destination}:${date}`;

    for (const code of CABIN_CODES) {
      const available = getCabinField<boolean | null>(record, code, "Available", args.includeFiltered) === true;
      if (!available) {
        continue;
      }

      const cabin = CODE_TO_CABIN[code];
      if (args.cabin && args.cabin !== cabin) {
        continue;
      }

      const metricOpts = { useRaw: args.includeFiltered, directOnly: args.direct };
      const miles = parseMiles(getCabinMetric(record, code, "MileageCost", metricOpts));

      let direct: boolean | null;
      if (args.direct) {
        direct = getCabinField<boolean | null>(record, code, "Direct", args.includeFiltered) ?? null;
      } else {
        const directMiles = parseMiles(
          getCabinMetric(record, code, "MileageCost", { useRaw: args.includeFiltered, directOnly: true })
        );
        if (miles !== null && miles > 0 && directMiles !== null && directMiles > 0) {
          direct = miles === directMiles;
        } else if (miles !== null && miles > 0) {
          direct = false;
        } else {
          direct = null;
        }
      }

      if (args.direct && direct !== true) {
        continue;
      }

      const dedupeKey = `${availabilityId}:${cabin}`;
      if (dedupe.has(dedupeKey)) {
        continue;
      }
      dedupe.add(dedupeKey);

      rows.push({
        date,
        source,
        origin,
        destination,
        cabin,
        miles,
        seats_available:
          getCabinMetric<number | null>(record, code, "RemainingSeats", metricOpts) ?? null,
        direct,
        airlines: parseAirlines(
          getCabinMetric<string | null>(record, code, "Airlines", metricOpts)
        ),
        updatedAt: record.UpdatedAt ?? null,
        searchUrl: buildSearchUrl(origin, destination, date, cabin, direct === true),
        availabilityId
      });
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.miles === null && b.miles !== null) {
      return 1;
    }
    if (a.miles !== null && b.miles === null) {
      return -1;
    }
    if (a.miles !== null && b.miles !== null && a.miles !== b.miles) {
      return a.miles - b.miles;
    }
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return CABIN_RANK[a.cabin] - CABIN_RANK[b.cabin];
  });

  return rows;
}
