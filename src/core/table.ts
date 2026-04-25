import type { FlightRow } from "./types";

type Column = {
  key: string;
  title: string;
};

const COLUMNS: Column[] = [
  { key: "date", title: "date" },
  { key: "program", title: "program" },
  { key: "cabin", title: "cabin" },
  { key: "miles", title: "miles" },
  { key: "seats_available", title: "seats_available" },
  { key: "duration_min", title: "duration_min" },
  { key: "routing", title: "routing" },
  { key: "airline", title: "airline" },
  { key: "link", title: "link" }
];

function pad(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return value + " ".repeat(width - value.length);
}

export function renderFlightTable(rows: FlightRow[]): string {
  if (rows.length === 0) {
    return "No availability found.";
  }

  const tableRows = rows.map((row) => ({
    date: row.date,
    program: row.source,
    cabin: row.cabin,
    miles: row.miles === null ? "-" : String(row.miles),
    seats_available: row.seats_available === null ? "-" : String(row.seats_available),
    duration_min: row.total_duration_minutes === null ? "-" : String(row.total_duration_minutes),
    routing: row.direct === true ? "direct" : row.direct === false ? "connecting" : "-",
    airline: row.airlines.join(", "),
    link: row.searchUrl
  }));

  const widths = new Map<string, number>();
  for (const column of COLUMNS) {
    widths.set(column.key, column.title.length);
  }

  for (const row of tableRows) {
    for (const column of COLUMNS) {
      const value = row[column.key as keyof typeof row];
      const current = widths.get(column.key) ?? 0;
      widths.set(column.key, Math.max(current, value.length));
    }
  }

  const header = `| ${COLUMNS.map((column) => pad(column.title, widths.get(column.key) ?? 0)).join(" | ")} |`;
  const divider = `|-${COLUMNS.map((column) => "-".repeat(widths.get(column.key) ?? 0)).join("-|-")}-|`;
  const lines = tableRows.map((row) => {
    const cols = COLUMNS.map((column) => {
      const value = row[column.key as keyof typeof row];
      return pad(value, widths.get(column.key) ?? value.length);
    });
    return `| ${cols.join(" | ")} |`;
  });

  return [header, divider, ...lines].join("\n");
}
