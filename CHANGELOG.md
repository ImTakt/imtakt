# Changelog — @imtakt/*

## 0.3.1 — 2026-07-15

**Harness product = `trip.agent` envelope; CLI Spec output; honest risk.**

### @imtakt/core

- `imtakt.agent.plan/v1` envelope (`schema`, `domain: transit`)
- DB-Navigator card fields: `headline`, local times, `products`, Umstieg labels
- `imtakt.connection_slack.v1` risk model (`riskScore`, `riskSignals`, inputsUnavailable)
- `intelligence` contract — no auto-pick; no vaporware layers on the wire

### @imtakt/sdk

- **`planTrip` → `trip.agent`** (compact envelope; `format()` reuses it)
- **`realtime` always normalized** when API omits the snapshot
- **`viewTrain` on harness** (+ `agent` compact train)
- `maxResults` applied client-side; parallel place resolve

### @imtakt/cli

- CLI Spec: TTY → markdown, pipe → JSON; `--json` / `-o` / `IMTAKT_FORMAT`
- Removed `--format both` (one channel per call)
- Exit codes: `0` ok · `1` usage · `2` api · `3` ambiguous (+ `candidates`)
- Structured errors on stderr: `{"error","code",…}`

### @imtakt/mcp

- `presentation: json|markdown` (default json); uses harness `viewTrain`

## 0.3.0 — 2026-07-14

**Agent harness — shared SDK workflows, context-aware CLI output.**

### @imtakt/core

- `journey-filters`, `place-confidence`, `format-markdown` primitives
- `pickBestMatch` token ranking; `agent-payload` compact shapes for agents
- `PlanJourneyRequest.preferences` (excludeLineClasses, maxTransfers, maxResults)
- Richer journey `meta` (confidence, alternatives) and `preferencesApplied`

### @imtakt/sdk

- **`createAgentHarness()`** — `resolvePlace`, `planTrip`, `stationStatus`, `format`
- `ImTaktAmbiguousPlaceError` for disambiguation
- **Compact output by default** — deduped stderr warnings, agent JSON without bloat; `verbosity: "full"` for complete shapes
- `planTrip.resolved` — human snap labels for client-side resolve
- Journey **realtime snapshot** respected — no false “schedule only” when GTFS-RT feed is active

### imtakt-router (deploy)

- Infer `realTime` on legs/departures from delays and platform changes when MOTIS omits the flag
- `POST /v1/journeys/plan` returns `realtime: { available, asOf }` (feed + per-leg)
- Live boards report feed availability even when departures are on time

### @imtakt/cli

- TTY → markdown, piped → compact agent JSON (`--format json|md`)
- `--verbose` for full API JSON + inline warnings
- `--regio` / `--no-ice`, `--from-id` / `--to-id`, `--confirm-snap`
- `live` accepts place name or `--stop-id`

### @imtakt/mcp

- Tools use agent harness; compact JSON by default; `presentation: "markdown"` for human view

## 0.2.0 — 2026-07-13

**Agent CLI + live station adoption.**

### @imtakt/core

- `StationLiveResponse`, `TrainProgress`, extended `ViewTrainResponse` schemas

### @imtakt/sdk

- `stationLive(stopId, opts?)` client method

### @imtakt/cli

- **Breaking:** JSON-only stdout; four commands: `find`, `journey`, `live`, `train`
- `live` requires `--stop-id` (from `find` output)
- Removed: `board`, `view`, `track`, `station`, `plan`, `--json`, human tables

### @imtakt/mcp

- `imtakt_station_live` tool
- `follow_train` prompt uses view wording (not track)

## 0.1.0 — 2026-07-07

**Launch:** npm publish of adoption harness for German transit intelligence.

### @imtakt/mcp

- Four MCP tools: `imtakt_find_station`, `imtakt_plan_journey`, `imtakt_view_station`, `imtakt_view_train`
- Default API: `https://api.imtakt.dev` — no API key
- `--version` / `--help` for local debugging

### @imtakt/cli

- Commands: `journey`, `board`, `station`, `train`
- `--json`, `--server`, `--at` flags
- `--version` / `--help`

### @imtakt/sdk + @imtakt/core

- Zod schemas for `/v1` requests and responses
- `resolveBaseUrl()` — SSRF-safe URL validation
- 30s request timeout on hosted API calls
