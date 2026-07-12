# Changelog — @imtakt/*

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
