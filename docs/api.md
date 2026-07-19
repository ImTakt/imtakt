# HTTP API reference

> **Adoption path is agent harness, MCP, or CLI.** Use those first. This reference is for integrators.

**Base URL:** `https://api.imtakt.dev`  
**OpenAPI:** `GET /v1/openapi.json`  
**Health:** `GET /health`

No authentication on the hosted free tier (rate limited). All responses are JSON.

## Endpoints

### `GET /health`

Platform health and capability flags.

```bash
curl -s https://api.imtakt.dev/health | jq .
```

### `POST /v1/stops/find`

Resolve stops by name or coordinates.

```bash
curl -s -X POST https://api.imtakt.dev/v1/stops/find \
  -H 'content-type: application/json' \
  -d '{"place":"Berlin Hbf","limit":5}' | jq .
```

**Body:** `{ place?: string, lat?: number, lng?: number, limit?: number }`

### `POST /v1/journeys/plan`

Plan multimodal journeys.

```bash
curl -s -X POST https://api.imtakt.dev/v1/journeys/plan \
  -H 'content-type: application/json' \
  -d '{"from":"Berlin Hbf","to":"München Hbf","when":"2026-07-03T09:00:00Z"}' | jq .
```

**Body:** `{ from: PlaceRef, to: PlaceRef, when: string }`

`PlaceRef` = string name · `{ lat, lng }` · `{ stopId }`

**Response:** `{ journeys: Journey[], meta: { from, to } }` with snapped stops in `meta`. Legs include optional `runId`.

### `GET /v1/trains/:runId`

Live full stats for a train run (stop-by-stop itinerary, delays).

```bash
curl -s https://api.imtakt.dev/v1/trains/RUN_ID | jq .
```

`runId` comes from a journey leg or board departure.

### `GET /v1/stops/:id/board`

Departures and arrivals at a stop ID (from find).

```bash
curl -s https://api.imtakt.dev/v1/stops/STOP_ID/board | jq .
```

### `GET /v1/meta/feed`

Feed freshness metadata (`syncedAt`, `stopCount`, `stale`).

## MCP mapping

| HTTP | MCP tool |
| --- | --- |
| `POST /v1/stops/find` | `imtakt_find` |
| `POST /v1/journeys/plan` | `imtakt_plan` |
| `GET /v1/journeys/options/:id` | `imtakt_show` |
| `GET /v1/stops/:id/live` | `imtakt_status` |
| `GET /v1/trains/:runId` | `imtakt_follow` |

## Errors

| Status | Meaning |
| --- | --- |
| 400 | Invalid request body |
| 404 | Place or stop not found |
| 502 / 503 | Upstream temporarily unavailable |

Public error messages reference **ImTakt Server** only.

## Schemas

TypeScript/Zod definitions: [`@imtakt/core`](https://github.com/ImTakt/imtakt/tree/main/packages/core).

Server implementation: [imtakt-router](https://github.com/ImTakt/imtakt-router) (not required for adoption).

## Attribution

Static GTFS schedule data via [gtfs.de](https://gtfs.de) (CC BY). See response `attribution` fields where present.
