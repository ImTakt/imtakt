# Agent onboarding

**Full harness:** [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding)

Install the ImTakt skill and connect MCP in one flow. Works with Claude Code, Cursor, Codex, and Windsurf. No login, no API key.

## Quick start

1. Open [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding)
2. Pick your platform tab and copy the install command
3. Paste the MCP block (or let the Codex plugin register it automatically)
4. Test: *"Plane morgen um 09:00 eine Fahrt von Berlin Hbf nach München Hbf."*

## Machine-readable skill

Fetch at session start:

```
https://imtakt.dev/agent-onboarding/SKILL.md
```

Repo reference copy: [SKILL.md](./SKILL.md)

## Codex plugin

Full plugin bundle (skill + MCP):

- Manifest: [imtakt.dev/agent-onboarding/codex/plugin.json](https://imtakt.dev/agent-onboarding/codex/plugin.json)
- MCP config: [imtakt.dev/agent-onboarding/codex/mcp.json](https://imtakt.dev/agent-onboarding/codex/mcp.json)

## MCP block

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

No `env` block for hosted API. Details: [mcp.md](./mcp.md)

## Tools

| Tool | Use when |
| --- | --- |
| `imtakt_find_station` | Place name or coordinates |
| `imtakt_plan_journey` | A→B with legs and transfers |
| `imtakt_view_station` | Departures at a station |
| `imtakt_travel_time` | Duration and transfer count only |

## Links

- Playground: [imtakt.dev/try](https://imtakt.dev/try)
- MCP guide: [mcp.md](./mcp.md)
- CLI guide: [cli.md](./cli.md)
- Health: `curl -s https://api.imtakt.dev/health`
