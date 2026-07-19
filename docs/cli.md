# CLI

Shell access to ImTakt Server — no login, no API key.

Prefer [`@imtakt/mcp`](./mcp.md) in MCP clients. Use the CLI when an agent runs shell commands.

See [agent-harness.md](./agent-harness.md) and [HARNESS.md](./HARNESS.md) for the time-first agent contract.

## Install

```bash
npx -y @imtakt/cli --help
curl -fsSL https://imtakt.dev/cli/install.sh | bash
```

Requires **Node.js 18+**.

## Output

| Context | Default stdout |
| --- | --- |
| **Terminal (TTY)** | Markdown |
| **Piped / agent** | Compact agent JSON (`board/v1` or `plan/v1`) |

Env: `IMTAKT_FORMAT`, `IMTAKT_SERVER_URL`, `IMTAKT_VIEW=board`, `IMTAKT_FARE=d-ticket`, `IMTAKT_WINDOW=120m`, `IMTAKT_ARRIVE_SLACK=10m`.

## Commands

| Command | Description |
| --- | --- |
| `imtakt find <place>` | Resolve a place (stop / station) |
| `imtakt plan <from> <to>` | Time-first options (board or full) |
| `imtakt show <optionId>` | Expand board option → full plan |
| `imtakt status <place>` | Live / local observation at a place |
| `imtakt follow <runId>` | Follow a train run |
| `imtakt analytics …` | Optional python3 transforms catalog |

**Aliases** (forward + stderr tip): `journey`→`plan`, `journey show`→`show`, `live`→`status`, `train`→`follow`, `commute`→`plan` with office board defaults.

## Time flags

| Flag | Meaning |
| --- | --- |
| `--at` / `--when` | Depart after (`now`, `+25m`, `08:00`, ISO) |
| `--arrive` | Arrive by (MOTIS arriveBy) |
| `--leave-by` | Latest acceptable departure |
| `--date YYYY-MM-DD` | Compose with HH:MM Berlin local |
| `--window 120m` | Search window |
| `--arrive-slack 10m` | Soft buffer |
| `--min-connection 5m` | Drop tight transfers |

## Plan flags

| Flag | Description |
| --- | --- |
| `--view board\|full` | Thin board vs full cards |
| `--fare d-ticket\|regio\|any` | Deutschlandticket / regio / all |
| `--nearby` / `--exact-stop` | Place cluster |
| `--pack windows\|round-trip\|day-chain` | Multi-anchor packs |
| `--regio`, `--no-ice` | Alias for `--fare regio` |

## Time-first workflow (preferred)

```bash
imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \
  --arrive 08:00 --date 2026-07-20 \
  --fare d-ticket --nearby --window 120m --view board --limit 20 --json

imtakt show opt_…. --json
```

**Commute recipe:** same as above (or set `IMTAKT_VIEW` / `IMTAKT_FARE` / `IMTAKT_WINDOW` / `IMTAKT_ARRIVE_SLACK`). No separate `commute` command.

**Anti-pattern:** looping `--at` every 3–5 minutes. Flow: **plan → show → follow**.

## Source

[packages/cli](https://github.com/ImTakt/imtakt/tree/main/packages/cli)
