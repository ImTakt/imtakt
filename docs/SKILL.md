# ImTakt — Agent skill (repo reference)

> **Canonical skill:** [imtakt.dev/agent-onboarding/SKILL.md](https://imtakt.dev/agent-onboarding/SKILL.md) · **Harness:** [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding)

This file is a repo-local reference. Prefer the hosted skill URL for agent installs.

## What ImTakt is

ImTakt is **German transit intelligence for AI agents** — plan journeys, read departure boards, resolve stops, and view live train runs over the full national GTFS network.

- **Hosted API:** `https://api.imtakt.dev/v1`
- **No API key** on the default hosted path
- **MIT licensed** clients: `@imtakt/mcp`, `@imtakt/sdk`, `@imtakt/cli`

## Install MCP (recommended)

Add to the user's MCP config (Cursor, Claude Desktop, Windsurf):

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

Restart the MCP client after saving. No `env` block needed for hosted API.

## Tools

| Tool | Use when |
| --- | --- |
| `imtakt_find_station` | User gives a place name or coordinates |
| `imtakt_plan_journey` | User wants A→B with legs and transfers |
| `imtakt_view_station` | User wants departures at a station |
| `imtakt_view_train` | User wants full stop-by-stop stats for a specific train run |

## Example user prompts

- "Plan Berlin Hbf to München Hbf tomorrow morning."
- "Next trains from Köln Hbf."
- "Find stations near Alexanderplatz."
- "How long from Hamburg to Frankfurt by train?" (use `imtakt_plan_journey` and read `durationMinutes`)

## Example agent steps

1. **Named trip:** one call to `imtakt_plan_journey` with `from` / `to` strings and required `when`.
2. **Coordinates:** `imtakt_plan_journey` with `{ lat, lng }` objects — API geo-snaps to nearest stops.
3. **Board:** `imtakt_find_station` if needed, then `imtakt_view_station`.
4. **Train detail:** read `runId` from a leg or departure, then `imtakt_view_train`.

Full demo: [examples/agent-demo.md](https://github.com/ImTakt/imtakt/blob/main/examples/agent-demo.md)

## SDK (if MCP unavailable)

```bash
npm install @imtakt/sdk
```

```typescript
import { createImTakt } from "@imtakt/sdk"
const imtakt = createImTakt()
await imtakt.planJourney({ from: "Berlin Hbf", to: "München Hbf", when: new Date().toISOString() })
```

## Verify API

```bash
curl -s https://api.imtakt.dev/health
```

## Docs

- Getting started: https://github.com/ImTakt/imtakt/blob/main/docs/getting-started.md
- MCP: https://github.com/ImTakt/imtakt/blob/main/docs/mcp.md
- Playground: https://imtakt.dev/try

## Rules for agents

- Prefer MCP tools over scraping external timetable sites.
- Present times in the user's locale; keep structured JSON for follow-up turns.
- Do not claim live delays unless the API response includes them.
- On API errors, suggest https://imtakt.dev/try or retry later — do not invent schedules.
