# seats — Search award flight availability from the terminal.

> [!NOTE]
> Unofficial tool. Not affiliated with or endorsed by [seats.aero](https://seats.aero). Beta; may have breaking changes.

Requires a [seats.aero](https://seats.aero) Pro subscription. API key at [seats.aero/settings](https://seats.aero/settings). [API docs](https://developers.seats.aero).

## Install (Homebrew)

```bash
brew install tksohishi/tap/seats
```

## Setup

```bash
seats setup
```

Or set the key directly:

```bash
export SEATS_AERO_API_KEY=your_api_key
```

`SEATS_AERO_API_KEY` takes precedence over `~/.config/seats/config.json`.

## Usage

```bash
seats flights --from JFK --to HND --date 2026-03-16
seats flights --from JFK --to HND --date 2026-03-16 --cabin business
seats flights --from JFK --to HND --date 2026-03-16 --date-end 2026-03-20
seats flights --from JFK --to HND --date 2026-03-16 --program american
seats flights --from JFK --to HND --date 2026-03-16 --alliance oneworld
seats flights --from JFK --to HND --date 2026-03-16 --transfer-partner amex
seats flights --from JFK --to HND --date 2026-03-16 --airline jl,nh
seats flights --from JFK --to HND --date 2026-03-16 --direct
seats flights --from JFK --to HND --date 2026-03-16 --min-seats 2
seats flights --from JFK --to HND --date 2026-03-16 --max-duration 1440
seats flights --from JFK --to HND --date 2026-03-16 --trips --json
seats flights --from JFK --to HND --date 2026-03-16 --include-filtered
seats flights --from JFK --to HND --date 2026-03-16 --debug
seats flights --from JFK --to HND --date 2026-03-16 --json
```

### Flags

| Flag | Description |
|------|-------------|
| `--from`, `--to` | IATA airport codes (required) |
| `--date` | Search date, YYYY-MM-DD (required) |
| `--date-end` | End of date range |
| `--cabin` | `economy`, `premium`, `business`, `first` |
| `--program` | Filter by program (e.g. `american,united`) |
| `--alliance` | `star`, `oneworld`, `skyteam` |
| `--transfer-partner` | `amex`, `chase`, `citi`, `capitalone`, `bilt` |
| `--airline` | IATA carrier codes or names (e.g. `jl,nh`) |
| `--min-seats` | Minimum available seats |
| `--max-duration` | Maximum itinerary duration in minutes |
| `--direct` | Non-stop only |
| `--trips` | Fetch flight segment details per row |
| `--include-filtered` | Include filtered/dynamic availability |
| `--json` | JSON output |
| `--debug` | Debug info to stderr |

Scope filters are optional. When omitted, the CLI searches across all programs.

## Development

```bash
bun install
bun run dev -- --help
bun test
```

## License

[MIT](LICENSE)
