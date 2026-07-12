# ImTakt

**German transit for AI agents — harness, MCP, or CLI. One command, no account.**

Hosted at **[api.imtakt.dev](https://api.imtakt.dev)** · **No login · No API key · No Docker**  
**Harness:** [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) · **Try:** [imtakt.dev/try](https://imtakt.dev/try)

---

## Why ImTakt?

- **Agent harness** — skill + MCP install for Claude Code, Cursor, Codex ([agent-onboarding](https://imtakt.dev/agent-onboarding))
- **MCP-first** — paste one JSON block; four tools, zero config
- **CLI** — `npx @imtakt/cli` for agent shell-outs (JSON stdout)
- **No signup** — hosted API is free to use; no keys on the adoption path
- **Full Germany** — ~675k stops, multimodal (rail, bus, tram, metro, ferry)
- **Open source (MIT)** — clients in this repo

---

## Agent harness (recommended)

[imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) — install skill, connect MCP, test a journey. Fetchable skill:

```
https://imtakt.dev/agent-onboarding/SKILL.md
```

→ [docs/agent-onboarding.md](docs/agent-onboarding.md)

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
| `imtakt_view_train` | Live full stats for a train run |

→ [docs/mcp.md](docs/mcp.md) · [imtakt.dev/mcp](https://imtakt.dev/mcp)

---

## CLI (agent shell-out)

```bash
npx @imtakt/cli find "Berlin Hbf"
npx @imtakt/cli live --stop-id "<id>"
npx @imtakt/cli journey "Berlin Hbf" "München Hbf"
npx @imtakt/cli train RUN_ID
```

Four commands. JSON stdout.

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

`@imtakt/sdk` and raw HTTP docs exist for integrators — see [docs/integrators.md](docs/integrators.md).

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
imtakt-gtfs/     Feeds and stop index
imtakt-apps/     imtakt.dev
```

## CI

```bash
bun install && bun run typecheck && bun run build
```

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Integrators

- `@imtakt/sdk` for app embeds
- Raw HTTP: [docs/api.md](docs/api.md)
- Self-host: [docs/integrators.md](docs/integrators.md)

API keys and billing ship after public launch.

---

## Status

[STATUS.md](STATUS.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

**License:** MIT
