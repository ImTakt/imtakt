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

Five verbs (same as CLI / harness). Flow: **plan → show → follow**.

| Tool | Description | API |
| --- | --- | --- |
| `imtakt_find` | Resolve place name or coordinates → stops | `POST /v1/stops/find` |
| `imtakt_plan` | Time-first board or full A→B plan | `POST /v1/journeys/plan` |
| `imtakt_show` | Expand board `optionId` → full plan | `GET /v1/journeys/options/:id` |
| `imtakt_status` | Live departures at a place | `GET /v1/stops/:id/live` |
| `imtakt_follow` | Follow a train run | `GET /v1/trains/:runId` |

Deprecated aliases (same handlers): `imtakt_find_station`, `imtakt_plan_journey`, `imtakt_journey_show`, `imtakt_station_live`, `imtakt_view_train`, `imtakt_view_station`.

### Arguments

**`imtakt_find`**

- `place` — station or place name (e.g. `"Berlin Hbf"`)
- `lat`, `lng` — coordinates (use instead of `place`)

**`imtakt_plan`**

- `from`, `to` — string place name, `{ lat, lng }`, or `{ stopId }`
- `when` / `arrive` / `leaveBy` — time intents (Berlin local or ISO)
- `view` — `board` (default for agents) or `full`

**`imtakt_show`**

- `optionId` — from board response

**`imtakt_status`**

- `station` — name, coordinates, or stop ID

**`imtakt_follow`**

- `runId` — stable train run id from a plan leg or board departure

## Example prompts

```
Use imtakt_find to find stops matching "Dom/Hbf Köln".

Use imtakt_plan from Berlin Alexanderplatz to Berlin Hbf with arrive 09:00 and view=board.

Use imtakt_show with an optionId from the board for full legs.

Use imtakt_status for München Hbf and show the next five departures.

Use imtakt_follow with a runId from an expanded leg to show the full stop list.
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
