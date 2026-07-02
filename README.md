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

Full MCP reference: [imtakt.dev/mcp](https://imtakt.dev/mcp)

## What's in this repo

```text
imtakt/
├── mcp/                 @imtakt/mcp — agent tools (→ hosted API)
├── packages/
│   ├── sdk/             @imtakt/sdk
│   ├── cli/             @imtakt/cli
│   └── core/            /v1 schemas
└── apps/api/            ImTakt Server (we host this for you)
```

**You don't need to clone this repo to use ImTakt.** Clone when you contribute to the server or clients.

## Self-host (later — not required for adoption)

Running your own API + data stack is supported but **not the focus right now**. Operators use sibling repo [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) for feeds, search index, and routing bootstrap. See [OPERATORS.md](https://github.com/ImTakt/imtakt-gtfs/blob/main/OPERATORS.md).

Local API dev (contributors only):

```bash
# Terminal 1 — data harness (imtakt-gtfs)
docker compose up postgres meilisearch -d && bun run feeds:refresh

# Terminal 2 — API with local override
export IMTAKT_SERVER_URL=http://localhost:3011
bash scripts/dev-api.sh
```

## Status

[implementation-status.md](implementation-status.md) · Company: [imtakt](https://github.com/ImTakt/imtakt)
