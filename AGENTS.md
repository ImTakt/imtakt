# ImTakt — agent guide

**Mandate:** Adoption repo — `@imtakt/mcp`, `@imtakt/cli`, and agent harness docs. No login on hosted path.

## Public adoption (now)

| Surface | Docs |
| --- | --- |
| Agent harness | [docs/agent-onboarding.md](docs/agent-onboarding.md) · [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) |
| `@imtakt/mcp` | [docs/mcp.md](docs/mcp.md) |
| `@imtakt/cli` | [docs/cli.md](docs/cli.md) |

Integrators (SDK, HTTP, self-host): [docs/integrators.md](docs/integrators.md).

## Ecosystem

| Repo | Guide | Role |
| --- | --- | --- |
| **imtakt** (here) | this file | MCP + SDK + CLI + core schemas |
| **imtakt-router** | [AGENTS.md](https://github.com/ImTakt/imtakt-router/blob/main/AGENTS.md) | ImTakt Server `/v1` |
| **imtakt-gtfs** | [AGENTS.md](https://github.com/ImTakt/imtakt-gtfs/blob/main/AGENTS.md) | Feeds and stop index |
| **imtakt-apps** | [AGENTS.md](https://github.com/ImTakt/imtakt-apps/blob/main/AGENTS.md) | imtakt.dev — harness, MCP, CLI, `/try` |
| **imtakt-docs** | [AGENTS.md](https://github.com/ImTakt/imtakt-docs/blob/main/AGENTS.md) | Extended documentation |

## Hot paths

| Goal | Read |
| --- | --- |
| Adoption defaults | `packages/core/src/constants.ts` → `IMTAKT_HOSTED_API_URL` |
| Agent harness | [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) |
| MCP tools | `mcp/src/main.ts` |
| Public docs | `docs/` |
| SDK | `packages/sdk/` |
| CLI | `packages/cli/` |
| Release status | [STATUS.md](STATUS.md) |
| Hosted API | [imtakt-router](https://github.com/ImTakt/imtakt-router) |
| Local API dev | [imtakt-router LOCALDEV](https://github.com/ImTakt/imtakt-router/blob/main/LOCALDEV.md) |

## Layout

```text
imtakt/
├── packages/{core,sdk,cli}/
├── mcp/                @imtakt/mcp
└── examples/
```

## Rules

1. **No `/v1` server here** — ImTakt Server lives in **imtakt-router**.
2. **Public surfaces** — MCP and README: say **ImTakt Server** only. Do not name internal data-plane components.
3. **Defaults** — clients point at `https://api.imtakt.dev`; `IMTAKT_SERVER_URL` overrides for local dev.
4. **Data plane** — feed sync and index build: **imtakt-gtfs**, not this repo.
5. **Site** — imtakt.dev agent harness is generated from **imtakt-apps**; canonical MCP/CLI prose lives in `docs/` here.

## Local dev (contributors)

See [CONTRIBUTING.md](CONTRIBUTING.md) and [imtakt-router LOCALDEV](https://github.com/ImTakt/imtakt-router/blob/main/LOCALDEV.md).
