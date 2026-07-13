# CLI

Agent shell access to ImTakt Server — **JSON on stdout**, no login, no API key.

Prefer [`@imtakt/mcp`](./mcp.md) in MCP clients. Use the CLI when an agent runs shell commands.

## Install

Permanent (recommended — puts `imtakt` on PATH):

```bash
curl -fsSL https://imtakt.dev/cli/install.sh | bash
```

One-off (no install):

```bash
npx -y @imtakt/cli --help
```

Requires **Node.js 18+**. The install script uses npm or bun when available; otherwise it bundles packages from the registry without the npm CLI (`IMTAKT_INSTALL_MODE=bundle`).

Environment variables: `IMTAKT_VERSION`, `IMTAKT_INSTALL_DIR` (default `~/.local/bin`), `IMTAKT_INSTALL_MODE` (`auto` | `npm` | `bun` | `bundle`).

## Output contract

| Stream | Format |
| --- | --- |
| **stdout** | JSON on success |
| **stderr** | `{"error":"message"}` on failure |

## Commands

| Command | Description |
| --- | --- |
| `imtakt find <query>` | Resolve stops by name |
| `imtakt journey <from> <to>` | Plan a journey |
| `imtakt live --stop-id <id>` | Station departures + `realtime.asOf` |
| `imtakt train <runId>` | Train run detail |

## Flags

| Flag | Used by | Description |
| --- | --- | --- |
| `--server <url>` | all | Override API base |
| `--at <iso>` | journey | Departure time (UTC; default: now) |
| `--when <iso>` | live | Board reference time (UTC) |
| `--limit <n>` | find, live | find: matches (default 8). live: departures (default 16, max 30) |
| `--stop-id <id>` | live | Required stop id from `find` |

Environment: `IMTAKT_SERVER_URL`.

## Workflow

```bash
imtakt find "Berlin Hbf"
imtakt live --stop-id "de_297950" --limit 20
imtakt journey "Berlin Hbf" "München Hbf" --at 2026-07-13T07:00:00Z
imtakt train "imtakt_run_v1:…"
```

## Browser GUI (`/try`)

Shareable query URLs — same data as CLI:

```
https://imtakt.dev/try?from=Berlin+Hbf&to=München+Hbf&auto=1
https://imtakt.dev/try?mode=board&station=Köln+Hbf&auto=1
https://imtakt.dev/try?mode=train&runId=…
```

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
