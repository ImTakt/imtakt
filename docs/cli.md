# CLI

Terminal access to the same hosted API as MCP — **no login, no API key**.

## Install

```bash
npx -y @imtakt/cli --help
```

## Commands

| Command | Description |
| --- | --- |
| `imtakt journey <from> <to>` | Plan a journey |
| `imtakt live <station>` | Full station live board (metadata + departures + `asOf`) |
| `imtakt track <runId>` | Live train progress through all stops |
| `imtakt board <station>` | Departure board (8 departures; alias of `live --limit 8`) |
| `imtakt train <runId>` | One-shot train view (alias of `track`) |
| `imtakt station <query>` | Find stops by name |

Aliases: `plan` for journey, `view` for board, `find` for station.

## Flags

| Flag | Description |
| --- | --- |
| `--json` | Structured JSON output |
| `--server <url>` | Override API base (default: hosted) |
| `--at <iso>` | Departure time for journey (ISO 8601; defaults to now) |
| `--limit <n>` | Departures for `live` (default 16, max 30) |
| `--watch <sec>` | Poll `track` every N seconds until the run completes |

Environment: `IMTAKT_SERVER_URL` overrides the default API base.

## Examples

```bash
# Human-readable journey (shows runIds for rail legs)
imtakt journey "Berlin Hbf" "München Hbf"

# Full live station board
imtakt live "Köln Hbf" --limit 20

# Track a train from a board runId
imtakt track "imtakt_run_v1:…" --watch 30

# JSON for scripts
imtakt live "Berlin Hbf" --json

# Local API
IMTAKT_SERVER_URL=http://localhost:3011 imtakt journey "Berlin Hbf" "München Hbf"
```

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
