# Getting started

**Three paths. No login. No API key.**

| Path | Where | Best for |
| --- | --- | --- |
| **Agent harness** | [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) | Claude Code, Cursor, Codex |
| **MCP** | `npx -y @imtakt/mcp` | Any MCP client |
| **CLI** | `npx @imtakt/cli journey "A" "B"` | Terminal, scripts |

## 1. Check the API

```bash
curl -s https://api.imtakt.dev/health
```

## 2a. Agent harness — skill + MCP in one flow

Open [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding), pick your platform, copy the install command, connect MCP.

Or fetch the skill directly:

```
https://imtakt.dev/agent-onboarding/SKILL.md
```

Full guide: [agent-onboarding.md](./agent-onboarding.md)

## 2b. MCP — paste and go

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

Restart your MCP client. Ask:

> Plan Berlin Hbf → München Hbf tomorrow at 09:00 with imtakt_plan_journey.

Full guide: [mcp.md](./mcp.md)

## 2c. CLI — one line

```bash
npx @imtakt/cli journey "Berlin Hbf" "München Hbf"
```

Add `--json` for scripts. Full guide: [cli.md](./cli.md)

## 3. Try in the browser

[imtakt.dev/try](https://imtakt.dev/try) — playground against the same API (no account).

---

**Integrators:** SDK, raw HTTP, self-host → [integrators.md](./integrators.md). API keys and billing ship after public launch.
