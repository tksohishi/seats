#!/usr/bin/env bun
import { runFlights } from "./commands/flights";
import { runHotels } from "./commands/hotels";
import { runSetup } from "./commands/setup";
import { CliError } from "./core/errors";

function printHelp(): void {
  console.log(`seats CLI

Usage:
  seats flights --from JFK --to HND --date 2026-03-16 [--date-end YYYY-MM-DD] [--cabin economy|premium|business|first] [--program p1,p2] [--alliance star|oneworld|skyteam] [--transfer-partner amex,chase] [--airline aa,jl] [--min-seats N] [--direct] [--include-filtered] [--trips] [--debug] [--json]
  seats setup
  seats hotels
`);
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "flights":
      await runFlights(rest);
      return;
    case "setup":
      await runSetup();
      return;
    case "hotels":
      await runHotels();
      return;
    default:
      throw new CliError(`Unknown command: ${command}`, 2);
  }
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
});
