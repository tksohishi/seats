import { describe, expect, test } from "bun:test";
import { parseFlightsArgs } from "../src/core/args";
import { CliError } from "../src/core/errors";

describe("parseFlightsArgs", () => {
  test("parses required flags", () => {
    const args = parseFlightsArgs(["--from", "jfk", "--to", "hnd", "--date", "2026-03-16"]);
    expect(args).toEqual({
      from: "JFK",
      to: "HND",
      date: "2026-03-16",
      dateEnd: "2026-03-16",
      cabin: undefined,
      programs: undefined,
      alliance: undefined,
      transferPartners: undefined,
      airlines: undefined,
      minSeats: undefined,
      maxDuration: undefined,
      direct: false,
      includeFiltered: false,
      trips: false,
      debug: false,
      json: false,
      argWarnings: []
    });
  });

  test("parses airport and city-area code lists", () => {
    const args = parseFlightsArgs([
      "--from",
      "nyc, jfk,NYC",
      "--to",
      "tyo, nrt",
      "--date",
      "2026-03-16"
    ]);

    expect(args.from).toBe("NYC,JFK");
    expect(args.to).toBe("TYO,NRT");
  });

  test("rejects malformed airport code lists", () => {
    expect(() =>
      parseFlightsArgs([
        "--from",
        "JFK,,EWR",
        "--to",
        "TYO",
        "--date",
        "2026-03-16"
      ])
    ).toThrow(CliError);

    expect(() =>
      parseFlightsArgs([
        "--from",
        "JFK",
        "--to",
        "HND2",
        "--date",
        "2026-03-16"
      ])
    ).toThrow(CliError);
  });

  test("parses optional flags", () => {
    const args = parseFlightsArgs([
      "--from=JFK",
      "--to=HND",
      "--date=2026-03-16",
      "--date-end=2026-03-20",
      "--cabin=business",
      "--program=american",
      "--alliance=oneworld",
      "--transfer-partner=membership-rewards,chase",
      "--airline=jal,NH",
      "--min-seats=2",
      "--max-duration=1440",
      "--direct",
      "--include-filtered",
      "--json"
    ]);
    expect(args.direct).toBe(true);
    expect(args.includeFiltered).toBe(true);
    expect(args.json).toBe(true);
    expect(args.cabin).toBe("business");
    expect(args.programs).toEqual(["american"]);
    expect(args.alliance).toBe("oneworld");
    expect(args.transferPartners).toEqual(["amex", "chase"]);
    expect(args.airlines).toEqual(["JL", "NH"]);
    expect(args.minSeats).toBe(2);
    expect(args.maxDuration).toBe(1440);
    expect(args.dateEnd).toBe("2026-03-20");
    expect(args.debug).toBe(false);
    expect(args.argWarnings).toEqual(["Normalized airline 'jal' to 'JL'."]);
  });

  test("throws on invalid airline", () => {
    expect(() =>
      parseFlightsArgs(["--from", "JFK", "--to", "HND", "--date", "2026-03-16", "--airline", "bad"])
    ).toThrow(CliError);
  });

  test("throws on invalid transfer partner", () => {
    expect(() =>
      parseFlightsArgs([
        "--from",
        "JFK",
        "--to",
        "HND",
        "--date",
        "2026-03-16",
        "--transfer-partner",
        "bad"
      ])
    ).toThrow(CliError);
  });

  test("throws on invalid min seats", () => {
    expect(() =>
      parseFlightsArgs([
        "--from",
        "JFK",
        "--to",
        "HND",
        "--date",
        "2026-03-16",
        "--min-seats",
        "0"
      ])
    ).toThrow(CliError);
  });

  test("throws on invalid max duration", () => {
    expect(() =>
      parseFlightsArgs([
        "--from",
        "JFK",
        "--to",
        "HND",
        "--date",
        "2026-03-16",
        "--max-duration",
        "0"
      ])
    ).toThrow(CliError);
  });

  test("adds warning for unknown program", () => {
    const args = parseFlightsArgs([
      "--from",
      "JFK",
      "--to",
      "HND",
      "--date",
      "2026-03-16",
      "--program",
      "notreal"
    ]);
    expect(args.programs).toEqual(["notreal"]);
    expect(args.argWarnings).toEqual([
      "Program 'notreal' is not in local known catalog. Passing through to API as-is."
    ]);
  });
});
