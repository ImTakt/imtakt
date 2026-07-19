# @imtakt/mcp

MCP server for **German transit intelligence** — five verbs over [api.imtakt.dev](https://api.imtakt.dev).

## Quick start

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

No API key. No env vars for hosted adoption.

## Tools

| Tool | Description |
| --- | --- |
| `imtakt_find` | Resolve place or coordinates → stops |
| `imtakt_plan` | Time-first board or full A→B plan |
| `imtakt_show` | Expand board `optionId` → full plan |
| `imtakt_status` | Live departures at a place |
| `imtakt_follow` | Follow a train run |

Flow: **plan → show → follow**. Prefer `view=board` + `arrive` for commute.

Deprecated aliases (same handlers): `imtakt_find_station`, `imtakt_plan_journey`, `imtakt_journey_show`, `imtakt_station_live`, `imtakt_view_train`, `imtakt_view_station`.

## Docs

- [MCP guide](https://github.com/ImTakt/imtakt/blob/main/docs/mcp.md)
- [Harness](https://github.com/ImTakt/imtakt/blob/main/docs/HARNESS.md)
- [Getting started](https://github.com/ImTakt/imtakt/blob/main/docs/getting-started.md)

## License

MIT
