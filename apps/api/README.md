# ImTakt Server (`apps/api`)

Bun-native HTTP API at `/v1/*`. Production entry: `src/server.ts`.

## Run

```bash
# From imtakt root (needs imtakt-gtfs harness up)
bash scripts/dev-api.sh

# Or directly
cd apps/api && bun run dev        # watch mode
cd apps/api && bun run start:prod # production flags
```

## Production tuning

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | — | Set `production` for prod behavior |
| `BUN_REUSE_PORT` | `0` | Set `1` on Linux for SO_REUSEPORT |
| `HEALTH_CACHE_SEC` | `10` (prod) | Cache `/health` probes |
| `FEED_CACHE_SEC` | `30` | Cache feed manifest reads |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Request body limit |
| `IMTAKT_OPS_HEALTH` | unset | Operator diagnostics on `/health` |

## Stack

- **Runtime:** Bun `Bun.serve` + Hono
- **Search:** Meilisearch (instant, typo-tolerant)
- **Catalog:** PostgreSQL (station normalization)
- **Routing:** internal bootstrap (journeys/board)

See [`.env.example`](../../.env.example).
