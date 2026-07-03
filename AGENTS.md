# ImTakt — agent guide

**Mandate:** Adoption repo — `@imtakt/mcp` and `@imtakt/cli` only for public surface. No login on hosted path.

## Public adoption (now)

| Package | Docs |
| --- | --- |
| `@imtakt/mcp` | [docs/mcp.md](docs/mcp.md) |
| `@imtakt/cli` | [docs/cli.md](docs/cli.md) |

Agent harness (skill + Codex plugin): [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding). SDK and HTTP reference: [docs/later.md](docs/later.md).

## Ecosystem

| Repo | Guide | Role |
| --- | --- | --- |
| **imtakt** | [AGENTS.md](https://github.com/ImTakt/imtakt) | Strategy, adoption map, shipping tracker |
| **imtakt** (here) | this file | MCP + SDK + CLI + core schemas |
| **imtakt-router** | [AGENTS.md](https://github.com/ImTakt/imtakt-router/blob/main/AGENTS.md) | ImTakt Server `/v1` + routing bootstrap + deploy |
| **imtakt-gtfs** | [AGENTS.md](https://github.com/ImTakt/imtakt-gtfs/blob/main/AGENTS.md) | Internal harness — feeds, stop index |
| **imtakt-apps** | [AGENTS.md](https://github.com/ImTakt/imtakt-apps/blob/main/AGENTS.md) | imtakt.dev — MCP, CLI, `/try`, agent harness |

**Continue execution:** [adoption-map.md](https://github.com/ImTakt/imtakt) (A1–A8 checklist).

## Hot paths

| Goal | Read |
| --- | --- |
| Adoption defaults | `packages/core/src/constants.ts` → `IMTAKT_HOSTED_API_URL` |
| MCP tools | `mcp/src/main.ts` |
| Agent harness | [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) |
| Public docs | `docs/` |
| SDK | `packages/sdk/` |
| CLI | `packages/cli/` |
| Shipping truth | [implementation-status.md](implementation-status.md) |
| Hosted API (ops) | [imtakt-router](https://github.com/ImTakt/imtakt-router) |
| Local API dev | `../imtakt-router/scripts/dev-api.sh` + sibling `imtakt-gtfs` Meili |

## Layout

```text
imtakt/
├── packages/{core,sdk,cli}/
├── mcp/                @imtakt/mcp
└── examples/
```

## Rules

1. **No `/v1` server here** — ImTakt Server lives in **imtakt-router** (`apps/api`).
2. **Public surfaces** — MCP and README: say **ImTakt Server** only. Never name Meilisearch, Postgres, or bootstrap router.
3. **Defaults** — clients point at `https://api.imtakt.dev`; `IMTAKT_SERVER_URL` overrides for local dev.
4. **Data plane** — feed sync, index build: **imtakt-gtfs**, not this repo.
5. **Site** — imtakt.dev hosts MCP copy blocks and the agent harness; canonical MCP/CLI docs stay in this repo.

## Local dev (contributors)

```bash
# Harness + API (sibling repos)
cd ../imtakt-gtfs && docker compose up postgres meilisearch -d && bun run feeds:refresh
cd ../imtakt-router && bash scripts/dev-api.sh

# MCP against local API
cd ../imtakt && export IMTAKT_SERVER_URL=http://localhost:3011 && bun run --filter @imtakt/mcp dev
```
