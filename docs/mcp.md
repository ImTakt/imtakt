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
| `imtakt_view_train` | Live full stats for a train run | `GET /v1/trains/:runId` |

### Arguments

**`imtakt_find_station`**

- `place` — station or place name (e.g. `"Berlin Hbf"`)
- `lat`, `lng` — coordinates (use instead of `place`)

**`imtakt_plan_journey`**

- `from`, `to` — string place name, `{ lat, lng }`, or `{ stopId }`
- `when` — required ISO 8601 departure time

**`imtakt_view_station`**

- `station` — name, coordinates, or stop ID

**`imtakt_view_train`**

- `runId` — stable train run id from a journey leg or board departure

## Example prompts

```
Use imtakt_find_station to find stops matching "Dom/Hbf Köln".

Use imtakt_plan_journey from Berlin Alexanderplatz to Berlin Hbf at 2026-07-03T09:00:00+02:00.

Use imtakt_view_station for München Hbf and show the next five departures.

Use imtakt_view_train with a runId from a board departure to show the full stop list.
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
