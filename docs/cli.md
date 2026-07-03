# CLI

Terminal access to the same hosted API as MCP — **no login, no API key**.

## Install

```bash
npm install -g @imtakt/cli
# or run once
npx @imtakt/cli --help
```

## Commands

| Command | Description |
| --- | --- |
| `imtakt journey <from> <to>` | Plan a journey |
| `imtakt board <station>` | Departure board |
| `imtakt train <runId>` | Live full stats for a train run |
| `imtakt station <query>` | Find stops by name |

Aliases: `plan` for journey, `view` for board, `find` for station.

## Flags

| Flag | Description |
| --- | --- |
| `--json` | Structured JSON output |
| `--server <url>` | Override API base (default: hosted) |
| `--at <iso>` | Departure time for journey (ISO 8601; defaults to now) |

Environment: `IMTAKT_SERVER_URL` overrides the default API base.

## Examples

```bash
# Human-readable journey
imtakt journey "Berlin Hbf" "München Hbf"

# JSON for scripts
imtakt journey "Berlin Hbf" "München Hbf" --json

# Departure board
imtakt board "Köln Hbf"

# Stop search
imtakt station "Frankfurt"

# Local API
IMTAKT_SERVER_URL=http://localhost:3011 imtakt journey "Berlin Hbf" "München Hbf"
```

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
