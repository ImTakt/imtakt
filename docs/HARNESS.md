# ImTakt systems harness (time-first)

Portable agent contract for `systems_run` / AUVY systems (`harness/imtakt/HARNESS.md`).

**Domain:** this file is the **transit** ops contract (`domain: "transit"`). Multi-domain scale-out (logistics reserved): [domains.md](./domains.md). Same envelope rules (`schema` + `domain`, board→expand, facts not picks) apply to every live domain.

## Five verbs (every domain)

| Verb | Meaning | Transit today |
|------|---------|---------------|
| `find` | Resolve a place | stop / station |
| `plan` | Time-first options | OD board / full plan |
| `show` | Expand one `optionId` | full `plan/v1` |
| `status` | Live observation at a place | station departures |
| `follow` | Follow a run / entity | train `runId` |

Plus `analytics` (catalog only). No separate commute/journey/live/train commands — those are thin aliases.

## Rules

1. Prefer **arrive-by + fare + board** on `plan` over bare OD with no time intent.
2. **Forbid** dense `--at` loops (every 3–5 minutes × origins).
3. Standard flow: **plan → show → follow**.
4. Always pass `--json` for agents; use Europe/Berlin times in prose replies.
5. On empty D-Ticket board: surface `alternatives.fasterWithSurcharge` once — do not silently retry without `--fare`.
6. Consume **`agent` / board envelope only** — do not dump the full harness result (`journeys` is empty on board by design).
7. Branch on envelope `domain` / `harness.profile.capabilities` — do not assume every domain has trains or D-Ticket.

## Fast commute (recipe — not a command)

```bash
imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \
  --arrive 2026-07-20T06:00:00.000Z \
  --fare d-ticket --nearby --window 120m --view board --limit 20 --json
```

Office defaults via env: `IMTAKT_VIEW=board`, `IMTAKT_FARE=d-ticket`, `IMTAKT_WINDOW=120m`, `IMTAKT_ARRIVE_SLACK=10m`.

## Deep dive

```bash
imtakt show <optionId> --json
```

## Round trip (no client matrix)

```bash
imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \
  --pack round-trip --arrive 08:00 --return-after 17:30 --fare d-ticket --view board --json
```

## Env defaults (agents)

```
IMTAKT_VIEW=board
IMTAKT_FARE=d-ticket
IMTAKT_WINDOW=120m
IMTAKT_ARRIVE_SLACK=10m
```

## Budget

| Step | Target |
|------|--------|
| Board (cluster + 120m + D-Ticket) | p95 ≤ 2s, one call |
| Expand one optionId | p95 ≤ 1s |
| Recommend leave time | ≤ 2 tool calls |

## Anti-patterns

- Looping `--at` every few minutes
- Re-querying Messe Süd / Nord manually (use `--nearby`)
- Full `plan/v1` on every probe (use `--view board` then `show`)
- Inventing hub stitch in the agent (server stitches when regio is sparse)
