# External agent demo

Prove an outsider can plan a multimodal DE trip in ≤3 MCP calls.

## Prerequisites

- Hosted API at `https://api.imtakt.dev` (`GET /health` → `ok: true`)
- `@imtakt/mcp` on npm

## MCP config

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

No `env` required — defaults to hosted API.

## Demo prompt

> Plan a trip from coordinates 52.5219, 13.4132 to 52.5250, 13.3694 at 2026-07-03T09:00:00Z. Use imtakt_plan once with view=board.

**Expected:** One MCP call returns a board (`imtakt.agent.board/v1`) or plan envelope with snapped stops (Alexanderplatz area → Hauptbahnhof area). Expand via `imtakt_show` only if legs are needed.

## Acceptance

- [ ] ≤3 MCP tool calls for coord→coord multimodal trip
- [ ] Response includes `meta.from.snappedStop` and `meta.to.snappedStop`
- [ ] Non-team agent integration documented (issue or screenshot)

See [docs/getting-started.md](../docs/getting-started.md) and [docs/mcp.md](../docs/mcp.md).
