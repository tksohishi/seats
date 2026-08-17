import { describe, expect, test } from "bun:test";
import {
  attachTrips,
  getTripSearchOptions,
  resolveRequestedPrograms
} from "../src/commands/flights";
import { CliError } from "../src/core/errors";
import type { FlightRow, FlightsArgs, Trip } from "../src/core/types";
import { KNOWN_SOURCES } from "../src/core/types";

function makeArgs(overrides: Partial<FlightsArgs> = {}): FlightsArgs {
  return {
    from: "JFK",
    to: "HND",
    date: "2026-03-16",
    dateEnd: "2026-03-16",
    direct: false,
    includeFiltered: false,
    trips: false,
    debug: false,
    json: false,
    argWarnings: [],
    ...overrides
  };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    cabin: "business",
    miles: 60000,
    taxes: 5000,
    taxesCurrency: "USD",
    flights: "AA1",
    connections: [],
    stops: 0,
    departsAt: "2026-03-16T10:00:00Z",
    arrivesAt: "2026-03-16T22:00:00Z",
    totalDuration: 720,
    aircraft: ["Boeing 787-9"],
    seats: 2,
    segments: [],
    ...overrides
  };
}

function makeRow(overrides: Partial<FlightRow> = {}): FlightRow {
  return {
    date: "2026-03-16",
    source: "american",
    origin: "JFK",
    destination: "HND",
    cabin: "business",
    miles: 60000,
    taxes: 5000,
    taxesCurrency: "USD",
    seats_available: 2,
    direct: true,
    airlines: ["AA"],
    total_duration_minutes: 720,
    updatedAt: null,
    searchUrl: "https://seats.aero/search",
    availabilityId: "availability-1",
    ...overrides
  };
}

describe("resolveRequestedPrograms", () => {
  test("uses api default when no scope filters are provided", () => {
    const scope = resolveRequestedPrograms(makeArgs());
    expect(scope.requestedPrograms).toEqual([...KNOWN_SOURCES].sort());
    expect(scope.apiSources).toBeUndefined();
  });

  test("uses known programs when filtering only by airline", () => {
    const scope = resolveRequestedPrograms(makeArgs({ airlines: ["JL"] }));
    expect(scope.requestedPrograms).toEqual([...KNOWN_SOURCES].sort());
    expect(scope.apiSources).toEqual([...KNOWN_SOURCES].sort());
  });

  test("resolves transfer-partner unions", () => {
    const scope = resolveRequestedPrograms(
      makeArgs({ transferPartners: ["amex", "chase"] })
    );

    expect(scope.requestedPrograms).toEqual([
      "aeromexico",
      "aeroplan",
      "delta",
      "emirates",
      "etihad",
      "flyingblue",
      "jetblue",
      "lifemiles",
      "qantas",
      "qatar",
      "singapore",
      "united",
      "virginatlantic"
    ]);
    expect(scope.apiSources).toEqual(scope.requestedPrograms);
    expect(scope.warnings).toEqual([
      "Transfer-partner mapping is local and may lag newly added programs."
    ]);
  });

  test("intersects transfer partners with alliance", () => {
    const scope = resolveRequestedPrograms(
      makeArgs({ alliance: "star", transferPartners: ["chase"] })
    );

    expect(scope.requestedPrograms).toEqual(["aeroplan", "singapore", "united"]);
    expect(scope.apiSources).toEqual(["aeroplan", "singapore", "united"]);
    expect(scope.warnings).toEqual([
      "Alliance mapping is local and may lag newly added programs.",
      "Transfer-partner mapping is local and may lag newly added programs."
    ]);
  });

  test("throws when scope filters do not overlap", () => {
    expect(() =>
      resolveRequestedPrograms(
        makeArgs({ programs: ["qatar"], transferPartners: ["bilt"] })
      )
    ).toThrow(CliError);
  });
});

describe("getTripSearchOptions", () => {
  test("requests full trips for --trips", () => {
    expect(getTripSearchOptions(makeArgs({ trips: true }))).toEqual({
      includeTrips: true,
      minifyTrips: false
    });
    expect(getTripSearchOptions(makeArgs({ trips: true, maxDuration: 1440 }))).toEqual({
      includeTrips: true,
      minifyTrips: false
    });
  });

  test("requests minified trips only for duration filtering", () => {
    expect(getTripSearchOptions(makeArgs({ maxDuration: 1440 }))).toEqual({
      includeTrips: true,
      minifyTrips: true
    });
    expect(getTripSearchOptions(makeArgs())).toEqual({
      includeTrips: false,
      minifyTrips: false
    });
  });
});

describe("attachTrips", () => {
  test("uses inline trips without calling the fallback", async () => {
    const row = makeRow({ trips: [makeTrip()] });
    let fallbackCalls = 0;

    await attachTrips([row], async () => {
      fallbackCalls += 1;
      return [];
    });

    expect(fallbackCalls).toBe(0);
    expect(row.trips).toHaveLength(1);
    expect(row.trips?.[0]?.segments).toEqual([]);
  });

  test("shares one fallback request across cabin rows", async () => {
    const businessRow = makeRow();
    const economyRow = makeRow({ cabin: "economy", miles: 30000 });
    let fallbackCalls = 0;

    await attachTrips([businessRow, economyRow], async () => {
      fallbackCalls += 1;
      return [
        makeTrip({ cabin: "economy", miles: 30000 }),
        makeTrip({ cabin: "business", miles: 60000 })
      ];
    });

    expect(fallbackCalls).toBe(1);
    expect(businessRow.trips?.map((trip) => trip.cabin)).toEqual(["business"]);
    expect(economyRow.trips?.map((trip) => trip.cabin)).toEqual(["economy"]);
  });

  test("caches an empty fallback across cabin rows", async () => {
    const businessRow = makeRow();
    const economyRow = makeRow({ cabin: "economy", miles: 30000 });
    let fallbackCalls = 0;

    await attachTrips([businessRow, economyRow], async () => {
      fallbackCalls += 1;
      return [];
    });

    expect(fallbackCalls).toBe(1);
    expect(businessRow.trips).toBeUndefined();
    expect(economyRow.trips).toBeUndefined();
  });

  test("filters trips and updates duration for --max-duration", async () => {
    const row = makeRow({
      total_duration_minutes: 1500,
      trips: [makeTrip({ totalDuration: 1500 }), makeTrip({ miles: 70000, totalDuration: 900 })]
    });

    await attachTrips([row], async () => [], 1000);

    expect(row.trips?.map((trip) => trip.totalDuration)).toEqual([900]);
    expect(row.total_duration_minutes).toBe(900);
  });

  test("keeps fallback duration when every trip exceeds --max-duration", async () => {
    const row = makeRow({ total_duration_minutes: null });

    await attachTrips([row], async () => [makeTrip({ totalDuration: 1500 })], 1000);

    expect(row.trips).toBeUndefined();
    expect(row.total_duration_minutes).toBe(1500);
  });
});
