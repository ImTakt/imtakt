# Agent patterns

Recipes using the **agent harness** (`@imtakt/sdk`) or **CLI** (same logic). Prefer harness facets for decisions; Python only for multi-search / day-of transforms.

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
const trip = await harness.planTrip({ from: "Berlin Hbf", to: "München Hbf" })
const { journeys } = harness.format(trip, "journey", {
  labels: trip.labels,
  warnings: trip.warnings,
}).payload as {
  journeys: Array<{
    option: number
    tags?: string[]
    durationMinutes: number
    totalDelayMinutes: number
    riskLevel: "low" | "medium" | "high"
    transferGaps: { at: string; minutes: number }[]
    lines: string[]
  }>
}
// Agent policy (yours): e.g. prefer low risk, then tags.includes("fastest")
```

```bash
imtakt journey "Berlin Hbf" "München Hbf" --format json 2>/dev/null \
  | jq '.journeys[] | {option, tags, durationMinutes, totalDelayMinutes, riskLevel}'
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
const train = await harness.client.viewTrain(runId)
harness.format(train, "train").payload
```

## 7. Time grounding

```bash
WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
imtakt journey "Berlin Hbf" "München Hbf" --at "$WHEN"
```

## Scale-out note

Today’s domain is **transit**. The analytics catalog reserves `logistics` so a future multi-domain planning harness can share discovery patterns without changing `createAgentHarness()` surface area.
