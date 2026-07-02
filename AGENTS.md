# ImTakt — agent guide

**Mandate:** Product repo — ImTakt Server (`/v1`), `@imtakt/mcp`, `@imtakt/sdk`, `@imtakt/cli`. Default adoption path is **hosted** (`api.imtakt.dev`); local dev is for contributors only.

## Ecosystem

| Repo | Guide | Role |
| --- | --- | --- |
| **imtakt** | [AGENTS.md](https://github.com/ImTakt/imtakt) | Strategy, adoption map, shipping tracker |
| **imtakt** (here) | this file | API + MCP + SDK + CLI |
| **imtakt-gtfs** | [AGENTS.md](https://github.com/ImTakt/imtakt-gtfs/blob/main/AGENTS.md) | Internal harness — feeds, index, imtakt-router |
| **imtakt-apps** | [AGENTS.md](https://github.com/ImTakt/imtakt-apps/blob/main/AGENTS.md) | imtakt.dev site + `/try` only |

**Continue execution:** [adoption-map.md](https://github.com/ImTakt/imtakt) (A1–A8 checklist).

## Hot paths

| Goal | Read |
| --- | --- |
| Adoption defaults | `packages/core/src/constants.ts` → `IMTAKT_HOSTED_API_URL` |
| `/v1` routes | `apps/api/src/app.ts` |
| Production server | `apps/api/src/server.ts` |
| MCP tools | `mcp/src/tools.ts` |
| Shipping truth | [implementation-status.md](implementation-status.md) |
| Deploy hosted API | [deploy/DEPLOY.md](deploy/DEPLOY.md) |
| Local dev | `scripts/dev-api.sh` + sibling `imtakt-gtfs` Meili on `:7700` |

## Layout

```text
imtakt/
├── apps/api/           ImTakt Server (Bun + Hono)
├── packages/{core,sdk,cli}/
├── mcp/                @imtakt/mcp
├── deploy/             Railway
└── scripts/dev-api.sh  port 3011
```

## Rules

1. **Public surfaces** — MCP, `/v1` errors, README: say **ImTakt Server** only. Never name Meilisearch, Postgres, or bootstrap router.
2. **Defaults** — clients point at `https://api.imtakt.dev`; `IMTAKT_SERVER_URL` overrides for local dev.
3. **Data plane** — feed sync, index build, compose: **imtakt-gtfs**, not this repo.
4. **Claims** — marketing copy lives in **imtakt-apps**; capability claims must match [implementation-status.md](implementation-status.md).
5. **Intelligence** — no `/intel/v1`, billing, or Console code here (commercial boundary).

## Local dev (contributors)

```bash
# Harness first (sibling repo)
cd ../imtakt-gtfs && docker compose up postgres meilisearch -d && bun run feeds:refresh

# API
cd ../imtakt && export IMTAKT_SERVER_URL=http://localhost:3011 && bash scripts/dev-api.sh
```
