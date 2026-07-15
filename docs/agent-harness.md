# Agent harness (`@imtakt/sdk`)

**Canonical agent API** for ImTakt — resolve places, plan trips, live boards, and compact output. The CLI and MCP server are thin wrappers around the same harness.

The harness is a **fact layer for LLM agents**: deterministic facets, comparison index, and an `intelligence` contract. It never picks a winner. Classical ML is reserved for future historical/predictive enrichments — see [agent-intelligence.md](./agent-intelligence.md).

Low-level HTTP remains available as `harness.client` or `createImTakt()`.

## Quick start

```typescript
import { createImTakt, createAgentHarness } from "@imtakt/sdk"

const harness = createAgentHarness(createImTakt())

const trip = await harness.planTrip({
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
const out = harness.format(trip, "journey") // reuses trip.agent
console.log(out.markdown)
```

## Presentation (JSON **or** markdown)

| Rule | Practice |
|------|----------|
| Primary for agents | **JSON** envelope (`presentation: "json"`, default) |
| Human / TTY | **Markdown** from the same compact facts |
| One channel per call | CLI/MCP select json **or** md — do not dump both (token cost) |
| Single source | Journey markdown is rendered from `CompactPlanTrip` |
| Envelope | `schema` + `domain: "transit"` — logistics later reuses the same contract |

```bash
imtakt journey "A" "B" --json           # agent/machine primary
imtakt journey "A" "B"                  # TTY → markdown; pipe → JSON (auto)
imtakt journey "A" "B" -o md            # force markdown
```

## Methods (stable surface)

| Method | Purpose |
|--------|---------|
| `resolvePlace(ref)` | Name / coords / `{stopId}` → stop with confidence + alternatives |
| `planTrip(...)` | Resolve → plan → filter → rank → **`agent` envelope** + normalized `realtime` |
| `stationStatus(ref)` | Resolve → live board with `realtime.asOf` |
| `viewTrain(runId)` | Train run + `agent` compact train payload |
| `format(data, kind, opts)` | JSON (default) or markdown; journey reuses `trip.agent` |
| `client` | Raw `ImTaktClient` |

`kind`: `"find"` | `"journey"` | `"live"` | `"train"`.

No analytics/decision methods on the harness — agents decide; optional Python pipes enrich further.

### Logistics scale-out

Same presentation model: versioned `schema`, `domain` (`transit` today; `logistics` reserved), undecided options, JSON-or-markdown. Multi-stop / freight planning adds domain-specific option shapes without a second CLI/MCP format stack.

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

## Train + live

```typescript
const board = await harness.stationStatus("Berlin Hbf")
const train = await harness.viewTrain(runId) // + train.agent
harness.format(train, "train") // compact: status, delays, windowed stops
```

## Preferences

```typescript
type TripPreferences = {
  excludeLongDistance?: boolean  // --regio
  minSnapConfidence?: number
  maxTransfers?: number
  maxResults?: number
  timezone?: string
}
```

## Multi-journey / logistics scale-out

Harness = **one O/D per `planTrip`**. Agents batch calls for commute windows, round trips, relocation matrices.

Optional merge pipes: `imtakt analytics use-case compare_time_windows`.

Discovery is domain-tagged (`transit` today; `logistics` reserved) so a future logistics planning harness can share the same catalog pattern without bloating this API.

## Errors

- **`ImTaktAmbiguousPlaceError`** — use `candidates` or `resolvePlace` / `imtakt find`
- **`ImTaktApiError`** — HTTP including `422 ambiguous_place`

## CLI / MCP

Same harness. Shell: `imtakt journey … --format json`. MCP tools delegate here.

## See also

- [agent-intelligence.md](./agent-intelligence.md) — ML vs LLM boundary + layers
- [agent-patterns.md](./agent-patterns.md)
- [agent-python-analytics.md](./agent-python-analytics.md) — optional pipes
- [cli.md](./cli.md) · [mcp.md](./mcp.md)
