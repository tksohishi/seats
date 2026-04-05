import { parseFlightsArgs } from "../core/args";
import { searchFlights } from "../core/api";
import { readConfig } from "../core/config";
import { CliError } from "../core/errors";
import { normalizeRows } from "../core/normalize";
import { renderFlightTable } from "../core/table";
import type { FlightsArgs } from "../core/types";
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

export async function runFlights(argv: string[]): Promise<void> {
  const args = parseFlightsArgs(argv);
  const config = await readConfig();
  if (!config?.apiKey) {
    throw new CliError("API key not found. Run `seats setup` or set SEATS_AERO_API_KEY.", 2);
  }

  const scope = resolveRequestedPrograms(args);
  const search = await searchFlights(config.apiKey, {
    from: args.from,
    to: args.to,
    date: args.date,
    dateEnd: args.dateEnd,
    direct: args.direct,
    includeFiltered: args.includeFiltered,
    sources: scope.apiSources,
    carriers: args.airlines
  });

  const warnings = [...args.argWarnings, ...scope.warnings, ...search.warnings];
  const allRows = normalizeRows(search.records, args);
  let rows = allRows;
  const preFilterRowCount = allRows.length;

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
        rowsAfterMinSeats: rows.length
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
