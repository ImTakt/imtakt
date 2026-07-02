# ImTakt

**German transit intelligence for agents** — four MCP tools, one hosted API, zero setup.

**Site:** [imtakt.dev](https://imtakt.dev) · **API:** [api.imtakt.dev](https://api.imtakt.dev) · **License:** MIT

## Connect your agent (adoption path)

Add to Cursor, Claude Desktop, or any MCP client:

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

That's it. `@imtakt/mcp` runs locally over stdio and calls **`https://api.imtakt.dev/v1`** — no API key, no docker, no GTFS, no second repo.

| Tool | What it does |
| --- | --- |
| `imtakt_find_station` | Resolve place name or coordinates → stops |
| `imtakt_plan_journey` | Plan A→B with legs and transfers |
| `imtakt_view_station` | Departure board at a stop |
| `imtakt_travel_time` | Fastest duration + transfer count |

CLI and SDK use the same hosted API by default:

```bash
npx @imtakt/cli journey "Berlin Hbf" "München Hbf"
npm i @imtakt/sdk
```

## What's in this repo

```text
imtakt/
├── mcp/                 @imtakt/mcp — agent tools (→ hosted API)
├── packages/
│   ├── sdk/             @imtakt/sdk
│   ├── cli/             @imtakt/cli
│   └── core/            /v1 schemas + constants
└── examples/
```

**ImTakt Server** (`/v1`) lives in **[imtakt-router](https://github.com/ImTakt/imtakt-router)** — we host it at `api.imtakt.dev`. You don't need to clone either repo to use ImTakt.

## Self-host (later — not required for adoption)

Operators: **[imtakt-router](https://github.com/ImTakt/imtakt-router)** (API + routing) + **[imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs)** (feeds + index). See [OPERATORS.md](https://github.com/ImTakt/imtakt-gtfs/blob/main/OPERATORS.md).

## Status

[implementation-status.md](implementation-status.md) · Company: [imtakt](https://github.com/ImTakt/imtakt)
