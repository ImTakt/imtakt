# Getting started

**Two paths. No login. No API key.**

| Path | Command | Best for |
| --- | --- | --- |
| **MCP** | `npx -y @imtakt/mcp` | Cursor, Claude, Windsurf |
| **CLI** | `npx @imtakt/cli journey "A" "B"` | Terminal, scripts |

## 1. Check the API

```bash
curl -s https://api.imtakt.dev/health
```

## 2a. MCP — paste and go

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

## 2b. CLI — one line

```bash
npx @imtakt/cli journey "Berlin Hbf" "München Hbf"
```

Add `--json` for scripts. Full guide: [cli.md](./cli.md)

## 3. Try in the browser

[imtakt.dev/try](https://imtakt.dev/try) — playground against the same API (no account).

---

**Not needed now:** SDK install, API keys, agent onboarding URLs, self-host. Those ship later → [later.md](./later.md).
