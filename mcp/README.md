# @imtakt/mcp

MCP server for **German transit intelligence** — four tools over [api.imtakt.dev](https://api.imtakt.dev).

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
| `imtakt_find_station` | Resolve place or coordinates → stops |
| `imtakt_plan_journey` | Plan A→B with legs |
| `imtakt_view_station` | Departure board |
| `imtakt_view_train` | Live full train stats |

## Docs

- [MCP guide](../docs/mcp.md)
- [Getting started](../docs/getting-started.md)

## License

MIT
