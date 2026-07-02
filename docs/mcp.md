# MCP

Connect any MCP client to German transit — **no login, no API key**.

## Install

No global install required:

```bash
npx -y @imtakt/mcp
```

## Configuration

**Default (hosted — recommended):**

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

- Calls **`https://api.imtakt.dev`** automatically
- No `env`, no API key, no second repo

**Local API (contributors):**

```json
{
  "mcpServers": {
    "imtakt": {
      "command": "npx",
      "args": ["-y", "@imtakt/mcp"],
      "env": {
        "IMTAKT_SERVER_URL": "http://localhost:3011"
      }
    }
  }
}
```

## Client setup

### Cursor

1. Open **Settings → MCP** (or edit `.cursor/mcp.json` in your project)
2. Paste the JSON block above
3. Restart MCP / reload window

### Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the `imtakt` entry under `mcpServers`, save, restart Claude.

### Windsurf / other clients

Same JSON shape under the client’s `mcpServers` key. See your client’s MCP documentation.

## Tools

| Tool | Description | API |
| --- | --- | --- |
| `imtakt_find_station` | Resolve place name or coordinates → stops | `POST /v1/stops/find` |
| `imtakt_plan_journey` | Plan A→B with legs and transfers | `POST /v1/journeys/plan` |
| `imtakt_view_station` | Departure board at a stop | `GET /v1/stops/:id/board` |
| `imtakt_travel_time` | Fastest duration + transfer count | `POST /v1/journeys/travel-time` |

### Arguments

**`imtakt_find_station`**

- `place` — station or place name (e.g. `"Berlin Hbf"`)
- `lat`, `lng` — coordinates (use instead of `place`)

**`imtakt_plan_journey`**

- `from`, `to` — string place name, `{ lat, lng }`, or `{ stopId }`
- `when` — optional ISO 8601 departure time

**`imtakt_view_station`**

- `station` — name, coordinates, or stop ID

**`imtakt_travel_time`**

- `from`, `to` — same shapes as plan journey

## Example prompts

```
Use imtakt_find_station to find stops matching "Dom/Hbf Köln".

Use imtakt_plan_journey from Berlin Alexanderplatz to Berlin Hbf leaving now.

Use imtakt_view_station for München Hbf and show the next five departures.

Use imtakt_travel_time from Hamburg Hbf to Frankfurt(Main)Hbf.
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| MCP server fails to start | Ensure Node 18+; run `npx -y @imtakt/mcp` in terminal for errors |
| Empty journeys / errors | Check `curl https://api.imtakt.dev/health` |
| Wrong environment | Unset `IMTAKT_SERVER_URL` for hosted default |
| Tool not found | Restart MCP client after config change |

## npm package

- **Package:** [`@imtakt/mcp`](https://www.npmjs.com/package/@imtakt/mcp)
- **Source:** [imtakt/mcp](https://github.com/ImTakt/imtakt/tree/main/mcp)

Public errors say **ImTakt Server** only — never internal stack component names.
