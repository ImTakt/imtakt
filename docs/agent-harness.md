# Agent harness (`@imtakt/sdk`)

**Canonical agent API** for ImTakt — five domain-neutral verbs plus compact output. The CLI and MCP server are thin wrappers around the same harness.

The harness is a **fact layer for LLM agents**: deterministic facets, comparison index, and an `intelligence` contract. It never picks a winner. Classical ML is reserved for future historical/predictive enrichments — see [agent-intelligence.md](./agent-intelligence.md).

Low-level HTTP remains available as `harness.client` or `createImTakt()`.

## Quick start

```typescript
import { createImTakt, createAgentHarness } from "@imtakt/sdk"

const harness = createAgentHarness(createImTakt())

const trip = await harness.plan({
  from: "Gräfelfing, Am Haag",
  to: "Augsburg Messe",
  when: new Date().toISOString(),
  preferences: { excludeLongDistance: true },
})

// Happy path — agent envelope is on the result (no format() required):
console.log(JSON.stringify(trip.agent))
// trip.agent.schema === "imtakt.agent.plan/v1"
// trip.realtime always set (normalized if API omits snapshot)
// trip.intelligence.decisionBoundary === "agent"

// Optional presentation (JSON default; markdown for TTY/humans):
const out = harness.format(trip, "plan") // reuses trip.agent
console.log(out.markdown)
```

## Presentation (JSON **or** markdown)

| Rule | Practice |
|------|----------|
| Primary for agents | **JSON** envelope (`presentation: "json"`, default) |
| Human / TTY | **Markdown** from the same compact facts |
| One channel per call | CLI/MCP select json **or** md — do not dump both (token cost) |
| Single source | Plan markdown is rendered from `CompactPlanTrip` |
| Envelope | `schema` + `domain: "transit"` — logistics later reuses the same contract |

```bash
imtakt plan "A" "B" --json           # agent/machine primary
imtakt plan "A" "B"                  # TTY → markdown; pipe → JSON (auto)
imtakt plan "A" "B" -o md            # force markdown
```

## Methods (stable surface)

| Method | Purpose |
|--------|---------|
| `find(ref)` | Name / coords / `{stopId}` → place with confidence + alternatives |
| `plan(...)` | Resolve → plan → filter → rank → **`agent` envelope** + normalized `realtime` |
| `show(optionId)` | Expand board option → full `plan/v1` |
| `status(ref)` | Resolve → live board with `realtime.asOf` |
| `follow(id)` | Follow a run / entity + `agent` compact payload |
| `format(data, kind, opts)` | JSON (default) or markdown; plan reuses `trip.agent` |
| `client` | Raw `ImTaktClient` |

`kind`: `"find"` | `"plan"` | `"status"` | `"follow"` (aliases: `journey`/`live`/`train`).

Deprecated aliases (one minor version): `resolvePlace`, `planTrip`, `showOption`, `stationStatus`, `viewTrain`.

No analytics/decision methods on the harness — agents decide; optional Python pipes enrich further.

### Multi-domain scale-out

Same five verbs for every domain — see [domains.md](./domains.md). No `createLogisticsHarness`.

```typescript
const harness = createAgentHarness(createImTakt(), { domain: "transit" })
harness.domain                    // "transit"
harness.profile.capabilities      // boardExpand, timeIntents, realtime, …
// createAgentHarness(client, { domain: "logistics" }) → throws until live
```

## Compact journey facets (happy path — no Python)

Compact payload mirrors a **DB Navigator** connection list (no functionality removed):

| Field | Meaning |
|-------|---------|
| `schema` / `domain` | `imtakt.agent.plan/v1` · `transit` (logistics reserved) |
| `trip` | From/to names + ids, `realtime: live\|schedule`, Europe/Berlin |
| `journeys[].headline` | Card title: `10:42→12:15 · 1 Std 33 Min · 1 Umstieg · RE 1, S 3` |
| `departLocal` / `arriveLocal` | Berlin HH:MM (ISO kept in `depart` / `arrive`) |
| `changes` / `changesText` | Umstiege (`transfers` kept as alias) |
| `products` | Line names in order (`lines` alias) |
| `legs[]` | Rides with `depLocal`/`arrLocal`, `product`, `platform`, `runId`, stop ids |
| `transferGaps[].label` | e.g. `8 Min Umstieg` |
| `riskLevel` / `riskScore` / `riskSignals` | Connection-slack heuristic |
| `tags` | `fastest` / `earliest` / `fewestTransfers` |

`intelligence`: `decisionBoundary`, present `layers` only, `riskModel`, `comparison`.

```typescript
const { trip, journeys, intelligence } = out.payload as {
  trip: { from: { name: string }; to: { name: string }; realtime: string }
  journeys: Array<{ option: number; headline: string; riskLevel: string; riskScore: number }>
  intelligence: { decisionBoundary: "agent"; comparison: { lowRisk: number[] } }
}
const candidates = journeys.filter((j) => j.riskLevel !== "high")
```

## Status + follow

```typescript
const board = await harness.status("Berlin Hbf")
const train = await harness.follow(runId) // + train.agent
harness.format(train, "follow") // compact: status, delays, windowed stops
```

## Preferences

```typescript
type TripPreferences = {
  excludeLongDistance?: boolean  // --regio / --fare d-ticket
  fare?: "any" | "regio" | "d-ticket"
  nearby?: boolean
  view?: "board" | "full"
  windowMinutes?: number
  arriveSlackMinutes?: number
  minSnapConfidence?: number
  maxTransfers?: number
  maxResults?: number
  timezone?: string
}
```

## Time-first (preferred)

```typescript
const board = await harness.plan({
  from: "Augsburg Messe",
  to: "Gräfelfing, Am Haag",
  arrive: "08:00",
  date: "2026-07-20",
  preferences: {
    fare: "d-ticket",
    nearby: true,
    view: "board",
    windowMinutes: 120,
  },
})
// board.agent.schema === "imtakt.agent.board/v1" — thin options only
// board.journeys is [] on board (legs via show)
const full = await harness.show(
  (board.agent as { options: { optionId: string }[] }).options[0].optionId,
)
// full.agent.schema === "imtakt.agent.plan/v1"
```

**Token hygiene:** emit `agent` only (CLI/MCP default). Board rows omit legs, riskSignals, intelligence prose, and redundant text fields.

See [HARNESS.md](./HARNESS.md). **Do not** dense-poll `--at` every few minutes. Flow: **plan → show → follow**.

## Multi-journey packs

Use `--pack windows|round-trip|day-chain` (server-side) instead of client `N× plan` + analytics merge for the happy path. Analytics pipes remain for offline transforms.

## Errors

- **`ImTaktAmbiguousPlaceError`** — use `candidates` or `find` / `imtakt find`
- **`ImTaktApiError`** — HTTP including `422 ambiguous_place`

## CLI / MCP

Same harness. Shell: `imtakt plan … --format json`. MCP: `imtakt_find` / `imtakt_plan` / `imtakt_show` / `imtakt_status` / `imtakt_follow`.

## See also

- [domains.md](./domains.md) — transit live, logistics reserved, five-verb map
- [HARNESS.md](./HARNESS.md) — time-first transit ops contract
- [agent-intelligence.md](./agent-intelligence.md) — ML vs LLM boundary + layers
- [agent-patterns.md](./agent-patterns.md)
- [agent-python-analytics.md](./agent-python-analytics.md) — optional pipes
- [cli.md](./cli.md) · [mcp.md](./mcp.md)
