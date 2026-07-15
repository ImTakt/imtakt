# CLI

Shell access to ImTakt Server — no login, no API key.

Prefer [`@imtakt/mcp`](./mcp.md) in MCP clients. Use the CLI when an agent runs shell commands.

See [agent-harness.md](./agent-harness.md) for the shared SDK logic behind this CLI.

## Install

```bash
npx -y @imtakt/cli --help
curl -fsSL https://imtakt.dev/cli/install.sh | bash
```

Requires **Node.js 18+**.

## Output

| Context | Default stdout | Override |
| --- | --- | --- |
| **Terminal (TTY)** | Markdown tables | `--format json` |
| **Piped / script** | Compact agent JSON | `--format md` or `--verbose` for full API JSON |

| Stream | Content |
| --- | --- |
| **stdout** | JSON or markdown on success |
| **stderr** | Snap/schedule warnings (deduped); `{"error":"..."}` on failure |

Default journey JSON is agent-compact: no coordinates/walk legs, plus **per-option facets** (`riskLevel`, `totalDelayMinutes`, `transferGaps`, `lines`, `tags`). Use `--verbose` for the full API shape.

## Commands

| Command | Description |
| --- | --- |
| `imtakt find <query>` | Resolve stops by name |
| `imtakt journey <from> <to>` | Plan a journey (uses agent harness) |
| `imtakt live --stop-id <id> \| <place>` | Live departures + `realtime.asOf` |
| `imtakt train <runId>` | Train run detail (compact JSON when piped) |
| `imtakt analytics` | Instant catalog + use cases (JSON when piped) |
| `imtakt analytics path <script>` | Resolve bundled `.py` path |
| `imtakt analytics use-case <id>` | Recipe for an ICP flow |

## Flags

| Flag | Used by | Description |
| --- | --- | --- |
| `--format json\|md\|both` | all | Output format (TTY default: md) |
| `--verbose` | all | Full JSON + markdown (runIds, inline warnings) |
| `--server <url>` | all | Override API base |
| `--at <iso>` | journey | Departure time UTC (default: now) |
| `--when <iso>` | live | Board reference time UTC |
| `--limit <n>` | find, live | Match/departure count |
| `--stop-id <id>` | live | Stop id from `find` |
| `--from-id` / `--to-id` | journey | Skip fuzzy name resolution |
| `--regio`, `--no-ice` | journey | Exclude ICE/IC/EC |
| `--confirm-snap` | journey | Fail on low-confidence snap |

Environment: `IMTAKT_SERVER_URL`.

## Workflow

```bash
imtakt find "Gräfelfing" --format md
imtakt journey "Gräfelfing, Am Haag" "Augsburg Messe" --regio
imtakt live "Berlin Hbf" --limit 20
imtakt journey "A" "B" --format json   # compact agent JSON (piped default)
```

All journey/live commands use the [agent harness](./agent-harness.md). Optional transforms: `imtakt analytics` then pipe to `python3` — see [agent-python-analytics.md](./agent-python-analytics.md).

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
