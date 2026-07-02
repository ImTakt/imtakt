# External agent demo (KR2)

Prove an outsider can plan a multimodal DE trip in ≤3 MCP calls.

## Prerequisites

- Hosted API at `https://api.imtakt.dev` (health: `GET /health`)
- `@imtakt/mcp@0.1.0` on npm

## Cursor / Claude Desktop config

```json
{
  "mcpServers": {
    "imtakt": {
      "command": "npx",
      "args": ["-y", "@imtakt/mcp@0.1.0"],
      "env": {
        "IMTAKT_SERVER_URL": "https://api.imtakt.dev"
      }
    }
  }
}
```

## Demo prompt

> Plan a trip from coordinates 52.5219, 13.4132 to 52.5250, 13.3694 leaving now. Use imtakt_plan_journey once.

**Expected:** One MCP call returns journeys with snapped stops (Alexanderplatz area → Hauptbahnhof area) and multimodal legs.

## Acceptance

- [ ] ≤3 MCP tool calls for coord→coord multimodal trip
- [ ] Response includes `meta.from.snappedStop` and `meta.to.snappedStop`
- [ ] Non-team agent integration documented (issue or screenshot)
