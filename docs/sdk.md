# SDK

> **Adoption path is agent harness, MCP, or CLI.** This doc is for app integrators. See [integrators.md](./integrators.md).

`@imtakt/sdk` is a thin TypeScript client over **ImTakt Server** `/v1`.

## Install

```bash
npm install @imtakt/sdk
# or
bun add @imtakt/sdk
```

Peer dependency: `@imtakt/core` (installed automatically).

## Quick start

```typescript
import { createImTakt } from "@imtakt/sdk"

const imtakt = createImTakt()
// baseUrl defaults to https://api.imtakt.dev (via @imtakt/core)
```

## API

### `createImTakt(options?)`

```typescript
type ImTaktClientOptions = {
  baseUrl?: string // default: IMTAKT_HOSTED_API_URL or process.env.IMTAKT_SERVER_URL
  timeoutMs?: number // default: 30_000
  fetch?: typeof fetch // inject for tests or proxies
}
```

Requests and responses are validated with Zod schemas from `@imtakt/core`. Failures throw:

- `ImTaktApiError` — HTTP 4xx/5xx (includes API `error` message when present)
- `ImTaktValidationError` — response body does not match the contract

### `findStops(request)`

```typescript
await imtakt.findStops({ place: "Berlin Hbf", limit: 5 })
await imtakt.findStops({ lat: 52.5219, lng: 13.4132 })
```

→ `POST /v1/stops/find`

### `planJourney(request)`

```typescript
await imtakt.planJourney({
  from: "Berlin Hbf",
  to: { lat: 48.1374, lng: 11.5755 },
  when: "2026-07-03T09:00:00.000Z",
})
```

→ `POST /v1/journeys/plan`

### `viewTrain(runId)`

```typescript
await imtakt.viewTrain("imtakt_run_v1:...")
```

→ `GET /v1/trains/:runId`

### `stationBoard(stopId)`

```typescript
const { matches } = await imtakt.findStops({ place: "Köln Hbf", limit: 1 })
await imtakt.stationBoard(matches[0]!.id)
```

→ `GET /v1/stops/:id/board`

## Types

Request/response types are re-exported from `@imtakt/sdk` or import from `@imtakt/core`:

```typescript
import { ImTaktApiError, type PlanJourneyResponse } from "@imtakt/sdk"
```

## Errors

- `ImTaktApiError` — non-2xx HTTP; `.status`, `.path`, `.message`, optional `.body`
- `ImTaktValidationError` — response failed Zod contract check
- Timeout — `Error` with `timed out after …ms`

## Local dev

```typescript
const imtakt = createImTakt({ baseUrl: "http://localhost:3011" })
```

Or set `IMTAKT_SERVER_URL=http://localhost:3011`.

## Source

[packages/sdk](https://github.com/ImTakt/imtakt/tree/main/packages/sdk)
