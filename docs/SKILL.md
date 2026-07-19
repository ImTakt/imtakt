# ImTakt — Agent skill (repo reference)

> **Canonical skill:** [imtakt.dev/agent-onboarding/SKILL.md](https://imtakt.dev/agent-onboarding/SKILL.md) · **Harness:** [HARNESS.md](./HARNESS.md)

## What ImTakt is

German transit intelligence for AI agents — plan journeys, boards, stops, live trains. The harness returns **facts**; your agent chooses. Prefer **time-first plan → show → follow**.

Envelopes always carry `schema` + `domain` (`transit` live; `logistics` reserved). Same five verbs cover freight/multi-stop later — see [domains.md](./domains.md).

## Install MCP

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

## Tools

| Tool | Use when |
| --- | --- |
| `imtakt_find` | Place name or coordinates |
| `imtakt_plan` | A→B — prefer `arrive` + `view=board` + `fare=d-ticket` |
| `imtakt_show` | Expand a board `optionId` to full plan |
| `imtakt_status` | Departures / live at a place |
| `imtakt_follow` | Train run by `runId` |

## Agent steps (office recipe)

1. **Board:** `imtakt_plan` with `arrive`, `fare: "d-ticket"`, `nearby: true`, `view: "board"`, `windowMinutes: 120`.
2. **Pick** using `connectionScore`, `arriveSlackMinutes`, `latest_safe`.
3. **Expand:** `imtakt_show` with that `optionId`.
4. Optional: `imtakt_follow` with a leg `runId`.

**Do not** poll `when` every few minutes. Flow: **plan → show → follow**.

## CLI

```bash
imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \
  --arrive 08:00 --date 2026-07-20 --fare d-ticket --nearby --view board --json
imtakt show <optionId> --json
```

Env: `IMTAKT_VIEW=board`, `IMTAKT_FARE=d-ticket`, `IMTAKT_WINDOW=120m`.

## Docs

- [HARNESS.md](./HARNESS.md) · [agent-harness.md](./agent-harness.md) · [cli.md](./cli.md) · [mcp.md](./mcp.md)
