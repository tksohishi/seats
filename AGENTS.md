# AGENTS.md

## Overview

CLI tool that searches award flight availability via the [seats.aero](https://seats.aero) API. TypeScript, runs on Bun.

## Commands

```bash
bun install            # install deps
bun run dev -- --help  # run CLI in dev
bun test               # run tests
bun run build          # bundle to dist/
bun run compile        # compile standalone binary
```

## Architecture

- `src/cli.ts` — entrypoint, parses top-level command and dispatches
- `src/commands/` — one file per subcommand (`flights`, `hotels`, `setup`)
- `src/core/` — shared logic: API client, arg parsing, config, output formatting, types
- `test/` — Bun test files, mirror `src/core/` and `src/commands/`

## Boundaries

- Never commit `.env` files or API keys
- `tmp/` is scratch space, never commit its contents
- Don't modify `dist/` directly; it's build output
