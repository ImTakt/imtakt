# ImTakt

**German transit for AI agents — MCP or CLI, one command, no account.**

Hosted at **[api.imtakt.dev](https://api.imtakt.dev)** · **No login · No API key · No Docker**  
**Try:** [imtakt.dev/try](https://imtakt.dev/try) · **Docs:** [docs/mcp.md](docs/mcp.md)

---

## Why ImTakt?

- **MCP-first** — paste one JSON block in Cursor or Claude; four tools, zero config
- **CLI second** — `npx @imtakt/cli` for scripts and terminal workflows
- **No signup** — hosted API is free to use; no keys on the adoption path
- **Full Germany** — ~675k stops, multimodal (rail, bus, tram, metro, ferry)
- **Open source (MIT)** — clients in this repo

*SDK, HTTP cookbooks, and agent self-onboarding ship later with self-host.*

---

## MCP (agents)

Add to **Cursor**, **Claude Desktop**, or **Windsurf**:

```json
{
  "mcpServers": {
    "imtakt": {
      "command": "npx",
      "args": ["-y", "@imtakt/mcp"]
    }
  }
}
```

That's the full config. No `env`. No API key. Defaults to **`https://api.imtakt.dev`**.

| Tool | What it does |
| --- | --- |
| `imtakt_find_station` | Resolve place or coordinates → stops |
| `imtakt_plan_journey` | Plan A→B with legs and transfers |
| `imtakt_view_station` | Departure board at a stop |
| `imtakt_travel_time` | Fastest duration + transfer count |

→ [docs/mcp.md](docs/mcp.md) · [imtakt.dev/mcp](https://imtakt.dev/mcp)

---

## CLI (terminal)

```bash
npx @imtakt/cli journey "Berlin Hbf" "München Hbf"
npx @imtakt/cli board "Köln Hbf"
npx @imtakt/cli station "Frankfurt"
npx @imtakt/cli travel-time "Hamburg Hbf" "Frankfurt(Main)Hbf" --json
```

Same hosted API. No login.

→ [docs/cli.md](docs/cli.md) · [imtakt.dev/cli](https://imtakt.dev/cli)

---

## Verify

```bash
curl -s https://api.imtakt.dev/health
```

---

## Packages (adoption)

| Package | Install |
| --- | --- |
| [`@imtakt/mcp`](mcp/) | `npx -y @imtakt/mcp` |
| [`@imtakt/cli`](packages/cli/) | `npx @imtakt/cli` |

`@imtakt/sdk` and raw HTTP docs exist for integrators — **not required for adoption**. See [docs/later.md](docs/later.md).

---

## Local override (optional)

```bash
export IMTAKT_SERVER_URL=http://localhost:3011   # contributors / self-host only
```

---

## Repo layout

```text
imtakt/          MCP + CLI + core schemas  ← adoption
imtakt-router/   ImTakt Server (hosted API)
imtakt-gtfs/     Transit engine (ops)
imtakt-apps/     imtakt.dev
```

## CI

```bash
bun install && bun run typecheck && bun run build
```

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml) · Map: [imtakt)

---

## Later (not adoption blockers)

- `@imtakt/sdk` for app embeds
- Agent self-onboarding (`SKILL.md` flows)
- Self-host compose
- API keys / billing

→ [docs/later.md](docs/later.md)

---

## Status

[implementation-status.md](implementation-status.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

**License:** MIT
