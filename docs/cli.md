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

## Output (best practice)

Pick **one** channel per invocation — JSON for machines/agents, markdown for humans.

| Context | Default stdout | Override |
| --- | --- | --- |
| **Terminal (TTY)** | Markdown (DB-style cards) | `--json` or `--format json` |
| **Piped / script / agent** | Compact agent JSON envelope | `--format md` |

| Stream | Content |
| --- | --- |
| **stdout** | Data only (JSON **or** markdown) |
| **stderr** | Warnings; on failure `{"error","code",...}` |

| Exit | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Usage / bad flags |
| `2` | API / network |
| `3` | Ambiguous place (`candidates` in error JSON) |

Flags: `--format json\|md\|auto`, `-o`, `--json`, `--pretty`.  
Env: `IMTAKT_FORMAT`, `IMTAKT_SERVER_URL`.

Default journey JSON is the agent envelope (`schema: imtakt.agent.plan/v1`, `domain: transit`) with per-option facets. Use `--verbose` only for raw API debug dumps.

## Commands

| Command | Description |
| --- | --- |
| `imtakt find <query>` | Resolve stops by name |
| `imtakt journey <from> <to>` | Plan a journey (agent harness) |
| `imtakt live --stop-id <id> \| <place>` | Live departures + `realtime.asOf` |
| `imtakt train <runId>` | Train run detail |
| `imtakt analytics` | Instant catalog + use cases |
| `imtakt analytics path <script>` | Resolve bundled `.py` path |
| `imtakt analytics use-case <id>` | Recipe for an ICP flow |

## Flags

| Flag | Description |
| --- | --- |
| `--format` / `-o` | `json` \| `md` \| `auto` |
| `--json` | Shorthand for `--format json` |
| `--pretty` | Indent JSON |
| `--verbose` | Raw API JSON (debug) |
| `--server <url>` | Override API base |
| `--at <iso>` | Journey departure UTC (default: now) |
| `--when <iso>` | Live board reference time UTC |
| `--limit <n>` | find / live counts |
| `--stop-id <id>` | Live by stop id |
| `--from-id` / `--to-id` | Skip fuzzy name resolution |
| `--regio`, `--no-ice` | Exclude ICE/IC/EC |
| `--confirm-snap` | Fail on low-confidence snap |

## Workflow

```bash
imtakt find "Gräfelfing" -o md
imtakt journey "Gräfelfing, Am Haag" "Augsburg Messe" --regio
imtakt live "Berlin Hbf" --limit 20
imtakt journey "A" "B" --json | jq '.journeys[] | {option, headline, riskLevel}'
```

Optional transforms: `imtakt analytics` then pipe to `python3` — see [agent-python-analytics.md](./agent-python-analytics.md).

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
