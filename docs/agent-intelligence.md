# Agent intelligence foundation

ImTakt’s harness is a **fact + context layer** for LLM agents. It does not pick journeys. Classical ML is reserved for longitudinal signals LLMs cannot see from a single plan — not for replacing agent judgment.

## Decision boundary (non-negotiable)

| Role | Owns |
|------|------|
| **Harness / core** | Resolve, plan, filter, rank *tags*, deterministic facets, honest layer metadata |
| **LLM agent** | Which option fits the user (prefs, trade-offs, conversation) |
| **Future `/intel` (stats → ML)** | Historical reliability + explainable forecasts (not shipped on this payload) |
| **Optional Python pipes** | Multi-search merges / day-of transforms — still no auto-pick |

`intelligence.decisionBoundary` is always `"agent"`. There is no `recommendation`, `bestOption`, or learned ranker.

## What is returned today (honest)

`intelligence.layers` lists **only layers present on this response**:

- `schedule_facts` — when there is at least one journey  
- `realtime_facts` — only when GTFS-RT is available on the response or legs are `realTime`

We do **not** emit placeholder `historical` / `predictive` layers, empty `enrichments[]`, or per-response ML capability ads. Those belong in docs / `ML_POLICY` (exported constant), not in every plan JSON.

### Risk model (`imtakt.connection_slack.v1`)

Deterministic heuristic — **not** P(miss), **not** ML:

| Idea | Practice |
|------|----------|
| Default min interchange | ~5 min (German Mindestübergangszeit baseline when stop-specific MIT unknown) |
| Effective gap | `scheduled − inbound_live_delay + outbound_live_delay` |
| Platform | +2 min required if platforms differ; −2 if same (when both known) |
| Hard high | Any cancelled rail leg, or effective gap &lt; 0 |
| Score → level | medium ≥ 20, high ≥ 50 (or hard fail) |
| Live delays | Counted only when `leg.realTime === true` |

Each option exposes `riskLevel`, `riskScore`, `riskSignals`. Plan-level `intelligence.riskModel` states `inputsUsed` / `inputsUnavailable` so agents know what was **not** invented (hub MIT, historical miss rates, forecasts).

### Comparison index

Pointers only: `fastest` / `earliest` / `fewestTransfers` from tags, `lowRisk` / `highRisk` buckets.  
`lowestLiveDelay` appears **only** when live RT delays exist — never a fake “lowest delay” on schedule-only plans.

## Layers (product roadmap vs client payload)

```
┌─────────────────────────────────────────────────────────────┐
│  Agent / LLM — policy over facets + user prefs              │
├─────────────────────────────────────────────────────────────┤
│  Predictive / historical — future /intel (not in payload)   │
├─────────────────────────────────────────────────────────────┤
│  Schedule + realtime facts — harness today                  │
└─────────────────────────────────────────────────────────────┘
```

## Where machine learning belongs later

**Do not** build learned journey rankers or black-box `bestOption`.  
**Do** reserve ML (after archive volume) for: delay distributions, hub miss rates, `P(delay)` / `P(miss)` with explainable factors.

Import `ML_POLICY` from `@imtakt/core` for the shared contract; it is intentionally **not** stuffed into every plan response.

## Agent usage pattern

Compact JSON is a DB-style connection list: `trip` + `journeys[].headline` (local times, Umstiege, products) plus risk facets. Prefer `headline` / `departLocal` in user-facing text; keep ISO / `runId` for tools.

```typescript
const planned = await harness.plan({ from: "Berlin Hbf", to: "München Hbf" })
const { trip, journeys, intelligence } = harness.format(planned, "plan").payload as {
  trip: { from: { name: string }; to: { name: string }; realtime: string }
  journeys: Array<{
    option: number
    headline: string
    riskLevel: string
    riskScore: number
    riskSignals: string[]
  }>
  intelligence: {
    decisionBoundary: "agent"
    riskModel: { id: string; inputsUnavailable: string[] }
    comparison: { lowRisk: number[]; fastest?: number }
  }
}

const pool = journeys.filter((j) => j.riskLevel !== "high")
const pick =
  pool.find((j) => j.option === intelligence.comparison.fastest) ??
  pool[0] ??
  journeys[0]
```

See also: [agent-harness.md](./agent-harness.md), [agent-patterns.md](./agent-patterns.md).
