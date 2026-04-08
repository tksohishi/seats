# seats

> **Unofficial** CLI for searching [seats.aero](https://seats.aero) award availability from the terminal. Not affiliated with or endorsed by seats.aero. This project is in **beta** and may have breaking changes.

Requires a [seats.aero](https://seats.aero) Pro subscription with Partner API access.

## Install (Homebrew)

```bash
brew install <tap-owner>/<tap-repo>/seats
```

## Development

Use Bun for dependency management and scripts.

```bash
bun install
bun run dev -- --help
bun test
```

## Setup

```bash
seats setup
```

You can also set the key via environment variable:

```bash
export SEATS_AERO_API_KEY=your_api_key
```

`SEATS_AERO_API_KEY` takes precedence over `~/.config/seats/config.json`.

## Usage

```bash
seats flights --from JFK --to HND --date 2026-03-16 --program american
seats flights --from JFK --to HND --date 2026-03-16 --cabin business
seats flights --from JFK --to HND --date 2026-03-16 --date-end 2026-03-20
seats flights --from JFK --to HND --date 2026-03-16 --alliance oneworld
seats flights --from JFK --to HND --date 2026-03-16 --transfer-partner amex
seats flights --from JFK --to HND --date 2026-03-16 --airline jl,nh
seats flights --from JFK --to HND --date 2026-03-16 --direct
seats flights --from JFK --to HND --date 2026-03-16 --min-seats 2
seats flights --from JFK --to HND --date 2026-03-16 --include-filtered
seats flights --from JFK --to HND --date 2026-03-16 --debug
seats flights --from JFK --to HND --date 2026-03-16 --json
```

Scope filters are optional. When omitted, the CLI searches across all programs.

- `--program <p1,p2,...>`
- `--alliance <star|oneworld|skyteam>`
- `--transfer-partner <amex|chase|citi|capitalone|bilt>`
- `--airline <aa,jl,nh,...>`
- `--include-filtered`

`--include-filtered` passes `include_filtered=true` to the Partner API and reads the response `*Raw` fields so filtered dynamic and direct variants are represented correctly.

Hotels command placeholder:

```bash
seats hotels
```
