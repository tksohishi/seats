import { describe, expect, test } from "bun:test";
import { resolveRequestedPrograms } from "../src/commands/flights";
import { CliError } from "../src/core/errors";
import type { FlightsArgs } from "../src/core/types";
import { KNOWN_SOURCES } from "../src/core/types";

function makeArgs(overrides: Partial<FlightsArgs> = {}): FlightsArgs {
  return {
    from: "JFK",
    to: "HND",
    date: "2026-03-16",
    dateEnd: "2026-03-16",
    direct: false,
    includeFiltered: false,
    debug: false,
    json: false,
    argWarnings: [],
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
