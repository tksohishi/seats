import { parseFlightsArgs } from "../core/args";
import { fetchTrips, searchFlights } from "../core/api";
import { readConfig } from "../core/config";
import { CliError } from "../core/errors";
import { normalizeRows } from "../core/normalize";
import { renderFlightTable } from "../core/table";
import type { FlightRow, FlightsArgs, Trip } from "../core/types";
import {
  ALLIANCE_SOURCES,
  KNOWN_SOURCES,
  TRANSFER_PARTNER_SOURCES,
  UNRELIABLE_SEAT_COUNT_SOURCES
} from "../core/types";

function formatProgramList(programs: string[]): string {
  if (programs.length <= 8) {
    return programs.join(", ");
  }
  const shown = programs.slice(0, 8);
  return `${shown.join(", ")} ... (+${programs.length - 8} more)`;
}

export function resolveRequestedPrograms(args: FlightsArgs): {
  requestedPrograms: string[];
  apiSources?: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const scopeSets: string[][] = [];
  const appliedFlags: string[] = [];

  if (args.programs) {
    scopeSets.push([...new Set(args.programs)]);
    appliedFlags.push("--program");
  }

  if (args.alliance) {
    scopeSets.push([...ALLIANCE_SOURCES[args.alliance]]);
    appliedFlags.push("--alliance");
    warnings.push("Alliance mapping is local and may lag newly added programs.");
  }

  if (args.transferPartners) {
    const transferPrograms = args.transferPartners.flatMap(
      (transferPartner) => TRANSFER_PARTNER_SOURCES[transferPartner]
    );
    scopeSets.push([...new Set(transferPrograms)]);
    appliedFlags.push("--transfer-partner");
    warnings.push("Transfer-partner mapping is local and may lag newly added programs.");
  }

  if (scopeSets.length === 0) {
    const requestedPrograms = [...KNOWN_SOURCES].sort();
    return {
      requestedPrograms,
      apiSources: args.airlines ? requestedPrograms : undefined,
      warnings
    };
  }

  let requestedPrograms = scopeSets[0];
  for (const scopeSet of scopeSets.slice(1)) {
    const allowed = new Set(scopeSet);
    requestedPrograms = requestedPrograms.filter((program) => allowed.has(program));
  }

  if (requestedPrograms.length === 0) {
    throw new CliError(`Selected scope filters do not overlap: ${appliedFlags.join(", ")}.`, 2);
  }

  requestedPrograms = [...new Set(requestedPrograms)].sort();
  return {
    requestedPrograms,
    apiSources: requestedPrograms,
    warnings
  };
}

export function getTripSearchOptions(args: FlightsArgs): {
  includeTrips: boolean;
  minifyTrips: boolean;
} {
  const hasMaxDuration = typeof args.maxDuration === "number";
  return {
    includeTrips: args.trips || hasMaxDuration,
    minifyTrips: hasMaxDuration && !args.trips
  };
}

export async function attachTrips(
  rows: FlightRow[],
  loadTrips: (availabilityId: string, taxesCurrency: string | null) => Promise<Trip[]>,
  maxDuration?: number
): Promise<void> {
  const fallbackCache = new Map<string, Trip[]>();

  for (const row of rows) {
    let trips = row.trips;
    if (!trips || trips.length === 0) {
      let fallbackTrips = fallbackCache.get(row.availabilityId);
      if (!fallbackTrips) {
        fallbackTrips = await loadTrips(row.availabilityId, row.taxesCurrency);
        fallbackCache.set(row.availabilityId, fallbackTrips);
      }
      trips = fallbackTrips.filter((trip) => trip.cabin === row.cabin);
    }

    const tripDurations = trips
      .map((trip) => trip.totalDuration)
      .filter((duration) => duration > 0);
    if (tripDurations.length > 0) {
      row.total_duration_minutes = Math.min(...tripDurations);
    }

    if (typeof maxDuration === "number") {
      trips = trips.filter(
        (trip) => trip.totalDuration > 0 && trip.totalDuration <= maxDuration
      );
    }

    if (trips.length === 0) {
      delete row.trips;
      continue;
    }

    row.trips = trips;
  }
}

function printFlightsHelp(): void {
  console.log(`seats flights: search award flight availability

Usage:
  seats flights --from JFK --to HND --date 2026-03-16 [options]

Required:
  --from CODE[,CODE]      Origin airport or city-area codes (e.g. JFK,LGA,EWR)
  --to CODE[,CODE]        Destination airport or city-area codes (e.g. HND,NRT)
  --date YYYY-MM-DD      Departure date (or range start with --date-end)

Options:
  --date-end YYYY-MM-DD  End of date range (inclusive)
  --cabin CABIN          economy | premium | business | first
  --program p1,p2        Scope to specific programs (e.g. aeroplan,united)
  --alliance NAME        star | oneworld | skyteam
  --transfer-partner P   amex,chase,citi,capitalone,bilt
  --airline a,b          Filter by operating carrier (IATA codes or aliases)
  --min-seats N          Require at least N seats available
  --max-duration N       Maximum itinerary duration in minutes
  --direct               Direct flights only
  --include-filtered     Include results the API would normally filter
  --trips                Include itinerary details (segments may be empty)
  --debug                Print fetch/normalize summary to stderr
  --json                 Emit JSON instead of a table
  -h, --help             Show this help
`);
}

export async function runFlights(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printFlightsHelp();
    return;
  }
  const args = parseFlightsArgs(argv);
  const config = await readConfig();
  if (!config?.apiKey) {
    throw new CliError("API key not found. Run `seats setup` or set SEATS_AERO_API_KEY.", 2);
  }

  const scope = resolveRequestedPrograms(args);
  const tripSearchOptions = getTripSearchOptions(args);
  const search = await searchFlights(config.apiKey, {
    from: args.from,
    to: args.to,
    date: args.date,
    dateEnd: args.dateEnd,
    direct: args.direct,
    includeFiltered: args.includeFiltered,
    includeTrips: tripSearchOptions.includeTrips,
    minifyTrips: tripSearchOptions.minifyTrips,
    sources: scope.apiSources,
    carriers: args.airlines
  });

  const warnings = [...args.argWarnings, ...scope.warnings, ...search.warnings];
  const allRows = normalizeRows(search.records, args);
  let rows = allRows;
  const preFilterRowCount = allRows.length;
  let rowsAfterMinSeats = rows.length;
  let rowsAfterDuration = rows.length;

  if (typeof args.minSeats === "number") {
    const sourcesWithUnknownCount = new Set(
      allRows.filter((row) => row.seats_available === null).map((row) => row.source)
    );
    const sourcesWithUnreliableCount = new Set(
      allRows
        .filter((row) => UNRELIABLE_SEAT_COUNT_SOURCES.has(row.source))
        .map((row) => row.source)
    );

    rows = allRows.filter((row) => {
      if (UNRELIABLE_SEAT_COUNT_SOURCES.has(row.source)) {
        return true;
      }
      return row.seats_available === null || row.seats_available >= args.minSeats!;
    });
    rowsAfterMinSeats = rows.length;
    rowsAfterDuration = rows.length;

    if (sourcesWithUnknownCount.size > 0) {
      warnings.push(
        `Seat count is unavailable for: ${[...sourcesWithUnknownCount].sort().join(", ")}. Minimum seat filter could not be verified for those rows.`
      );
    }

    if (sourcesWithUnreliableCount.size > 0) {
      warnings.push(
        `Seat count may be unreliable for: ${[...sourcesWithUnreliableCount].sort().join(", ")}. These results are shown without enforcing --min-seats.`
      );
    }
  }

  if (args.trips) {
    await attachTrips(
      rows,
      (availabilityId, taxesCurrency) =>
        fetchTrips(config.apiKey, availabilityId, { taxesCurrency }),
      args.maxDuration
    );
  }

  if (typeof args.maxDuration === "number") {
    const sourcesWithUnknownDuration = new Set(
      rows.filter((row) => row.total_duration_minutes === null).map((row) => row.source)
    );

    rows = rows.filter(
      (row) => row.total_duration_minutes !== null && row.total_duration_minutes <= args.maxDuration!
    );
    rowsAfterDuration = rows.length;

    if (sourcesWithUnknownDuration.size > 0) {
      warnings.push(
        `Duration data is unavailable for: ${[...sourcesWithUnknownDuration].sort().join(", ")}. These rows were removed by --max-duration.`
      );
    }
  }

  const matchedPrograms = [...new Set(rows.map((row) => row.source).filter((value) => value.length > 0))].sort();

  if (args.debug) {
    const requestedScope = scope.apiSources ?? ["<api-default>"];
    const summary = {
      request: {
        from: args.from,
        to: args.to,
        date: args.date,
        dateEnd: args.dateEnd,
        cabin: args.cabin ?? "<any>",
        direct: args.direct,
        includeFiltered: args.includeFiltered,
        minSeats: args.minSeats ?? null,
        maxDuration: args.maxDuration ?? null,
        programs: args.programs ?? null,
        alliance: args.alliance ?? null,
        transferPartners: args.transferPartners ?? null,
        airlines: args.airlines ?? null,
        apiSources: requestedScope
      },
      fetch: {
        fetchedPages: search.stats.fetchedPages,
        fetchedRecords: search.stats.fetchedRecords,
        truncated: search.stats.truncated
      },
      normalize: {
        rowsBeforeMinSeats: preFilterRowCount,
        rowsAfterMinSeats,
        rowsAfterDuration
      },
      coverage: {
        requestedPrograms: scope.requestedPrograms.length,
        matchedPrograms: matchedPrograms.length
      }
    };
    console.error(`debug: ${JSON.stringify(summary)}`);
  }

  if (args.json) {
    const payload = {
      query: {
        from: args.from,
        to: args.to,
        date: args.date,
        dateEnd: args.dateEnd,
        cabin: args.cabin,
        programs: args.programs,
        alliance: args.alliance,
        transferPartners: args.transferPartners,
        airlines: args.airlines,
        minSeats: args.minSeats,
        maxDuration: args.maxDuration,
        direct: args.direct,
        includeFiltered: args.includeFiltered,
        json: true
      },
      stats: {
        fetchedPages: search.stats.fetchedPages,
        fetchedRecords: search.stats.fetchedRecords,
        returnedRows: rows.length,
        truncated: search.stats.truncated
      },
      programCoverage: {
        requested: {
          count: scope.requestedPrograms.length,
          programs: scope.requestedPrograms
        },
        matched: {
          count: matchedPrograms.length,
          programs: matchedPrograms
        }
      },
      warnings,
      rows
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const table = renderFlightTable(rows);
  console.log(table);
  console.log(`Program coverage requested (${scope.requestedPrograms.length}): ${formatProgramList(scope.requestedPrograms)}`);
  console.log(`Program coverage matched (${matchedPrograms.length}): ${formatProgramList(matchedPrograms)}`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.error(`warning: ${warning}`);
    }
  }
}
