import { CliError } from "./errors";
import type { Alliance, Cabin, FlightsArgs, TransferPartner } from "./types";
import {
  AIRLINE_ALIASES,
  ALLIANCE_ALIASES,
  ALLIANCE_SOURCES,
  TRANSFER_PARTNER_ALIASES
} from "./types";

const FLAG_VALUE_KEYS = new Set([
  "--from",
  "--to",
  "--date",
  "--date-end",
  "--cabin",
  "--program",
  "--alliance",
  "--transfer-partner",
  "--airline",
  "--min-seats",
  "--max-duration"
]);
const BOOLEAN_FLAGS = new Set(["--direct", "--include-filtered", "--trips", "--json", "--debug"]);
const VALID_CABINS = new Set<Cabin>(["economy", "premium", "business", "first"]);
const CABIN_ALIASES: Record<string, Cabin> = {
  economy: "economy",
  coach: "economy",
  y: "economy",
  premium: "premium",
  premiumeconomy: "premium",
  w: "premium",
  business: "business",
  biz: "business",
  j: "business",
  c: "business",
  first: "first",
  f: "first"
};
const KNOWN_PROGRAMS = new Set(
  Object.values(ALLIANCE_SOURCES).flatMap((list) => list)
);

function parseDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) {
    return false;
  }
  const normalized = new Date(time).toISOString().slice(0, 10);
  return normalized === value;
}

function parseIata(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new CliError(`Invalid airport code: ${value}. Expected 3-letter IATA code.`, 2);
  }
  return normalized;
}

function parseCsv(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter((item) => item.length > 0))];
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, "");
}

function suggestAirline(input: string): string[] {
  const token = normalizeToken(input);
  if (!token) {
    return [];
  }
  const keys = Object.keys(AIRLINE_ALIASES);
  const startsWith = keys.filter((key) => key.startsWith(token)).slice(0, 5);
  if (startsWith.length > 0) {
    return startsWith.map((key) => `${key} -> ${AIRLINE_ALIASES[key]}`);
  }
  const includes = keys.filter((key) => key.includes(token)).slice(0, 5);
  return includes.map((key) => `${key} -> ${AIRLINE_ALIASES[key]}`);
}

function normalizeAirlines(raw: string): { codes: string[]; warnings: string[] } {
  const tokens = parseCsv(raw);
  const warnings: string[] = [];
  const out = new Set<string>();

  for (const token of tokens) {
    if (/^[a-zA-Z0-9]{2}$/.test(token)) {
      out.add(token.toUpperCase());
      continue;
    }

    const normalized = normalizeToken(token);
    const mapped = AIRLINE_ALIASES[normalized];
    if (!mapped) {
      const suggestions = suggestAirline(token);
      const suffix = suggestions.length > 0 ? ` Suggestions: ${suggestions.join(", ")}` : "";
      throw new CliError(`Unknown --airline value: ${token}.${suffix}`, 2);
    }
    out.add(mapped);
    warnings.push(`Normalized airline '${token}' to '${mapped}'.`);
  }

  return { codes: [...out], warnings };
}

function normalizeTransferPartners(raw: string): TransferPartner[] {
  const tokens = parseCsv(raw);
  const out = new Set<TransferPartner>();

  for (const token of tokens) {
    const mapped = TRANSFER_PARTNER_ALIASES[normalizeToken(token)];
    if (!mapped) {
      throw new CliError(
        `Unknown --transfer-partner value: ${token}. Use amex, chase, citi, capitalone, or bilt.`,
        2
      );
    }
    out.add(mapped);
  }

  return [...out];
}

export function parseFlightsArgs(argv: string[]): FlightsArgs {
  const map = new Map<string, string | boolean>();
  const argWarnings: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new CliError(`Unexpected argument: ${token}`, 2);
    }

    if (token.includes("=")) {
      const eqIndex = token.indexOf("=");
      const key = token.slice(0, eqIndex);
      const value = token.slice(eqIndex + 1);
      if (!FLAG_VALUE_KEYS.has(key)) {
        throw new CliError(`Unknown flag: ${key}`, 2);
      }
      if (!value) {
        throw new CliError(`Missing value for flag: ${key}`, 2);
      }
      map.set(key, value);
      continue;
    }

    if (BOOLEAN_FLAGS.has(token)) {
      map.set(token, true);
      continue;
    }

    if (!FLAG_VALUE_KEYS.has(token)) {
      throw new CliError(`Unknown flag: ${token}`, 2);
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new CliError(`Missing value for flag: ${token}`, 2);
    }
    map.set(token, next);
    i += 1;
  }

  const fromRaw = map.get("--from");
  const toRaw = map.get("--to");
  const dateRaw = map.get("--date");
  if (!fromRaw || !toRaw || !dateRaw) {
    throw new CliError("Missing required flags. Required: --from --to --date", 2);
  }

  const from = parseIata(String(fromRaw));
  const to = parseIata(String(toRaw));
  const date = String(dateRaw);
  if (!parseDate(date)) {
    throw new CliError(`Invalid --date value: ${date}. Expected YYYY-MM-DD.`, 2);
  }

  const dateEndRaw = map.get("--date-end");
  const dateEnd = dateEndRaw ? String(dateEndRaw) : date;
  if (!parseDate(dateEnd)) {
    throw new CliError(`Invalid --date-end value: ${dateEnd}. Expected YYYY-MM-DD.`, 2);
  }
  if (Date.parse(`${dateEnd}T00:00:00Z`) < Date.parse(`${date}T00:00:00Z`)) {
    throw new CliError("--date-end must be on or after --date.", 2);
  }

  const cabinRaw = map.get("--cabin");
  let cabin: Cabin | undefined;
  if (cabinRaw) {
    const raw = String(cabinRaw);
    const token = normalizeToken(raw);
    const mapped = CABIN_ALIASES[token] ?? (VALID_CABINS.has(raw.toLowerCase() as Cabin) ? (raw.toLowerCase() as Cabin) : undefined);
    if (!mapped) {
      throw new CliError(`Invalid --cabin value: ${cabinRaw}.`, 2);
    }
    cabin = mapped;
  }

  const minSeatsRaw = map.get("--min-seats");
  let minSeats: number | undefined;
  if (minSeatsRaw !== undefined) {
    const parsed = Number.parseInt(String(minSeatsRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new CliError("Invalid --min-seats value. Expected integer >= 1.", 2);
    }
    minSeats = parsed;
  }

  const maxDurationRaw = map.get("--max-duration");
  let maxDuration: number | undefined;
  if (maxDurationRaw !== undefined) {
    const parsed = Number.parseInt(String(maxDurationRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || String(parsed) !== String(maxDurationRaw)) {
      throw new CliError("Invalid --max-duration value. Expected integer >= 1.", 2);
    }
    maxDuration = parsed;
  }

  let programs: string[] | undefined;
  const programRaw = map.get("--program");
  if (programRaw) {
    programs = parseCsv(String(programRaw)).map((value) => value.toLowerCase());
    for (const program of programs) {
      if (!KNOWN_PROGRAMS.has(program)) {
        argWarnings.push(
          `Program '${program}' is not in local known catalog. Passing through to API as-is.`
        );
      }
    }
  }

  let alliance: Alliance | undefined;
  const allianceRaw = map.get("--alliance");
  if (allianceRaw) {
    const raw = String(allianceRaw).toLowerCase();
    const mapped = ALLIANCE_ALIASES[raw];
    if (!mapped) {
      throw new CliError("Invalid --alliance value. Use star, oneworld, or skyteam.", 2);
    }
    alliance = mapped;
  }

  let transferPartners: TransferPartner[] | undefined;
  const transferPartnerRaw = map.get("--transfer-partner");
  if (transferPartnerRaw) {
    transferPartners = normalizeTransferPartners(String(transferPartnerRaw));
  }

  let airlines: string[] | undefined;
  const airlineRaw = map.get("--airline");
  if (airlineRaw) {
    const normalized = normalizeAirlines(String(airlineRaw));
    airlines = normalized.codes;
    argWarnings.push(...normalized.warnings);
  }

  return {
    from,
    to,
    date,
    dateEnd,
    cabin,
    programs,
    alliance,
    transferPartners,
    airlines,
    minSeats,
    maxDuration,
    direct: map.get("--direct") === true,
    includeFiltered: map.get("--include-filtered") === true,
    trips: map.get("--trips") === true,
    debug: map.get("--debug") === true,
    json: map.get("--json") === true,
    argWarnings
  };
}
