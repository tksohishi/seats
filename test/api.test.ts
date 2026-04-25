import { describe, expect, test } from "bun:test";
import { searchFlights } from "../src/core/api";

describe("searchFlights", () => {
  test("sets carrier filter and omits sources when not provided", async () => {
    let calledUrl = "";
    const fetchImpl: typeof fetch = async (url) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          data: [],
          hasMore: false
        }),
        { status: 200 }
      );
    };

    await searchFlights(
      "k",
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: true,
        carriers: ["AA", "JL"]
      },
      { fetchImpl, maxPages: 50 }
    );

    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get("carriers")).toBe("AA,JL");
    expect(parsed.searchParams.get("include_filtered")).toBe("true");
    expect(parsed.searchParams.has("sources")).toBe(false);
  });

  test("sets trip include flags", async () => {
    let calledUrl = "";
    const fetchImpl: typeof fetch = async (url) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          data: [],
          hasMore: false
        }),
        { status: 200 }
      );
    };

    await searchFlights(
      "k",
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: false,
        includeTrips: true,
        minifyTrips: true
      },
      { fetchImpl, maxPages: 50 }
    );

    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get("include_trips")).toBe("true");
    expect(parsed.searchParams.get("minify_trips")).toBe("true");
  });

  test("follows pagination", async () => {
    let call = 0;
    const fetchImpl: typeof fetch = async () => {
      call += 1;
      if (call === 1) {
        return new Response(
          JSON.stringify({
            data: [{ ID: "1" }],
            hasMore: true,
            cursor: 123
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ ID: "2" }],
          hasMore: false
        }),
        { status: 200 }
      );
    };

    const result = await searchFlights(
      "k",
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: false,
        sources: ["american"],
        carriers: ["AA"]
      },
      { fetchImpl, maxPages: 50 }
    );

    expect(result.records.length).toBe(2);
    expect(result.stats.fetchedPages).toBe(2);
    expect(result.stats.truncated).toBe(false);
  });

  test("enforces page cap", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ ID: "1" }],
          hasMore: true,
          cursor: 999
        }),
        { status: 200 }
      );

    const result = await searchFlights(
      "k",
      {
        from: "JFK",
        to: "HND",
        date: "2026-03-16",
        dateEnd: "2026-03-16",
        direct: false,
        includeFiltered: false,
        sources: ["american"],
        carriers: ["AA"]
      },
      { fetchImpl, maxPages: 2 }
    );

    expect(result.stats.fetchedPages).toBe(2);
    expect(result.stats.truncated).toBe(true);
    expect(result.warnings.length).toBe(1);
  });
});
