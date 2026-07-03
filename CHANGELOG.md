# Changelog — @imtakt/*

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
