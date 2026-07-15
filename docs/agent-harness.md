# Agent harness (`@imtakt/sdk`)

**Canonical agent API** for ImTakt — resolve places, plan trips, live boards, and compact output. The CLI and MCP server are thin wrappers around the same harness.

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

const out = harness.format(trip, "journey", {
  labels: trip.labels,
  warnings: trip.warnings,
})
// out.payload.journeys[] — every viable option with decision facets
console.log(out.markdown)
```

## Methods (stable surface)

| Method | Purpose |
|--------|---------|
| `resolvePlace(ref)` | Name / coords / `{stopId}` → stop with confidence + alternatives |
| `planTrip({ from, to, when, preferences })` | Resolve → plan → filter → rank → warnings — **all options** |
| `stationStatus(ref)` | Resolve → live board with `realtime.asOf` |
| `format(data, kind, opts)` | Compact JSON + markdown + deduped stderr warnings |
| `client` | Raw `ImTaktClient` (`viewTrain`, etc.) |

`kind`: `"find"` | `"journey"` | `"live"` | `"train"`.

No analytics/decision methods on the harness — agents decide; optional Python pipes enrich further.

## Compact journey facets (happy path — no Python)

Every option in `format(trip, "journey").payload` includes:

| Field | Meaning |
|-------|---------|
| `tags` | `fastest` / `earliest` / `fewestTransfers` |
| `durationMinutes`, `transfers` | Schedule shape |
| `totalDelayMinutes` | Sum of rail-leg delays |
| `cancelledLegs` | Count |
| `transferGaps` | `{ at, minutes }[]` between rail legs |
| `riskLevel` | `low` / `medium` / `high` (facts: cancels, tight gaps, delay) |
| `lines` | Rail line names |
| `legs` | Compact legs with `runId` for drill-down |

**Agent decides** using user prefs over these fields. ImTakt never picks a winner.

```typescript
const { journeys } = out.payload as { journeys: Array<{ option: number; riskLevel: string; tags?: string[] }> }
// Agent policy example (lives in your agent — not ImTakt):
const candidates = journeys.filter((j) => j.riskLevel !== "high")
```

## Train + live

```typescript
const board = await harness.stationStatus("Berlin Hbf")
const train = await harness.client.viewTrain(runId)
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

- [agent-patterns.md](./agent-patterns.md)
- [agent-python-analytics.md](./agent-python-analytics.md) — optional pipes
- [cli.md](./cli.md) · [mcp.md](./mcp.md)
