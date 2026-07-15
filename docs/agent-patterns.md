# Agent patterns

Recipes using the **agent harness** (`@imtakt/sdk`) or **CLI** (same logic). Prefer harness facets + `intelligence` for decisions; Python only for multi-search / day-of transforms. Foundation: [agent-intelligence.md](./agent-intelligence.md).

## 1. Resolve before journey

```bash
imtakt find "Am Haag 8, Gräfelfing" --format md
imtakt journey "Gräfelfing, Am Haag" "Augsburg Messe" --from-id de_515932
```

```typescript
const from = await harness.resolvePlace("Am Haag 8, Gräfelfing", { field: "from" })
await harness.planTrip({ from: { stopId: from.stopId }, to: "Augsburg Messe" })
```

## 2. Regio only

```bash
imtakt journey "A" "B" --regio
```

```typescript
await harness.planTrip({ from: "A", to: "B", preferences: { excludeLongDistance: true } })
```

## 3. Compare all options (no Python)

```typescript
const planned = await harness.planTrip({ from: "Berlin Hbf", to: "München Hbf" })
const { trip, journeys, intelligence } = harness.format(planned, "journey", {
  labels: planned.labels,
  warnings: planned.warnings,
}).payload as {
  trip: { from: { name: string }; to: { name: string }; realtime: "live" | "schedule" }
  journeys: Array<{
    option: number
    headline: string
    departLocal: string
    arriveLocal: string
    changesText: string
    products: string[]
    riskLevel: "low" | "medium" | "high"
    riskScore: number
    riskSignals: string[]
  }>
  intelligence: {
    decisionBoundary: "agent"
    riskModel: { id: string; inputsUnavailable: string[] }
    comparison: { fastest?: number; lowRisk: number[] }
  }
}
// Present like DB: trip header + each headline; you pick using risk/tags/prefs
```

```bash
imtakt journey "Berlin Hbf" "München Hbf" --format json 2>/dev/null \
  | jq '{ trip, compare: .intelligence.comparison,
          options: [.journeys[] | {option, headline, riskLevel, riskScore}] }'
```

## 4. Multi time-window compare

```bash
imtakt analytics use-case compare_time_windows
```

Agent runs N× `imtakt journey`, merges with `merge-journey-searches`, then chooses.

## 5. Round trip

```bash
imtakt analytics use-case round_trip
```

All out×return pairs listed; agent picks the pair.

## 6. Live + train drill-down

```bash
imtakt live "Berlin Hbf" --format json 2>/dev/null \
  | python3 "$(imtakt analytics path live-delay-summary)"

# From a planned journey:
imtakt journey "A" "B" --format json 2>/dev/null \
  | python3 "$(imtakt analytics path extract-run-ids)"
imtakt train "$RUN_ID" --format json 2>/dev/null \
  | python3 "$(imtakt analytics path train-summary)"
```

```typescript
const train = await harness.viewTrain(runId) // train.agent = compact envelope
harness.format(train, "train").payload
```

## 7. Time grounding

```bash
WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
imtakt journey "Berlin Hbf" "München Hbf" --at "$WHEN"
```

## Scale-out note

Today’s domain is **transit**. The analytics catalog reserves `logistics` so a future multi-domain planning harness can share discovery patterns without changing `createAgentHarness()` surface area.
