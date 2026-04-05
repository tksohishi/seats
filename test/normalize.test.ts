import { describe, expect, test } from "bun:test";
import { normalizeRows } from "../src/core/normalize";

describe("normalizeRows", () => {
  test("expands available cabins into rows", () => {
    const rows = normalizeRows(
      [
        {
          ID: "abc",
          Date: "2026-03-16",
          Source: "american",
          Route: {
            OriginAirport: "JFK",
            DestinationAirport: "HND"
          },
          JAvailable: true,
          JMileageCost: "60000",
          JRemainingSeats: 2,
          JAirlines: "AA, JL",
          JDirect: true,
          YAvailable: true,
          YMileageCost: "30000",
          YRemainingSeats: 5,
          YAirlines: "AA",
          YDirect: false
        }
      ],
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: false,
        json: false
      }
    );

    expect(rows.length).toBe(2);
    expect(rows.map((row) => row.cabin)).toEqual(["economy", "business"]);
    expect(rows.find((row) => row.cabin === "business")?.miles).toBe(60000);
  });

  test("respects direct filter", () => {
    const rows = normalizeRows(
      [
        {
          ID: "abc",
          Date: "2026-03-16",
          Source: "american",
          Route: {
            OriginAirport: "JFK",
            DestinationAirport: "HND"
          },
          JAvailable: true,
          JMileageCost: "60000",
          JRemainingSeats: 2,
          JAirlines: "AA, JL",
          JDirect: false
        }
      ],
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: true,
        includeFiltered: false,
        json: false
      }
    );

    expect(rows.length).toBe(0);
  });

  test("prefers raw fields when include filtered is enabled", () => {
    const rows = normalizeRows(
      [
        {
          ID: "abc",
          Date: "2026-03-16",
          Source: "american",
          Route: {
            OriginAirport: "JFK",
            DestinationAirport: "HND"
          },
          JAvailable: true,
          JAvailableRaw: true,
          JMileageCost: "60000",
          JMileageCostRaw: 75000,
          JRemainingSeats: 0,
          JRemainingSeatsRaw: 2,
          JAirlines: "AA",
          JAirlinesRaw: "AA, JL",
          JDirect: false,
          JDirectRaw: true
        }
      ],
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: true,
        json: false
      }
    );

    expect(rows.length).toBe(1);
    expect(rows[0]?.miles).toBe(75000);
    expect(rows[0]?.seats_available).toBe(2);
    expect(rows[0]?.airlines).toEqual(["AA", "JL"]);
    expect(rows[0]?.direct).toBe(true);
  });

  test("uses direct raw metrics for direct-only searches when available", () => {
    const rows = normalizeRows(
      [
        {
          ID: "abc",
          Date: "2026-03-16",
          Source: "american",
          Route: {
            OriginAirport: "JFK",
            DestinationAirport: "HND"
          },
          JAvailable: true,
          JAvailableRaw: true,
          JMileageCostRaw: 137500,
          JRemainingSeatsRaw: 3,
          JAirlinesRaw: "AA",
          JDirect: false,
          JDirectRaw: true,
          JDirectMileageCostRaw: 450000,
          JDirectRemainingSeatsRaw: 1,
          JDirectAirlinesRaw: "AA"
        }
      ],
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: true,
        includeFiltered: true,
        json: false
      }
    );

    expect(rows.length).toBe(1);
    expect(rows[0]?.miles).toBe(450000);
    expect(rows[0]?.seats_available).toBe(1);
    expect(rows[0]?.direct).toBe(true);
  });
});
