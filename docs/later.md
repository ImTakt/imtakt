# Shipping later

These are **not** part of the current adoption path. MCP + CLI on the hosted API ship first.

## Deferred to self-host / Phase 2+

| Item | Notes |
| --- | --- |
| **API keys / login** | Billing and authenticated tiers |
| **`@imtakt/sdk`** | App embeds — see [sdk.md](./sdk.md) when you need it |
| **Raw HTTP cookbook** | [api.md](./api.md) |
| **Self-host compose** | [imtakt-router](https://github.com/ImTakt/imtakt-router) + [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) |

## For integrators today

If you must call HTTP or TypeScript directly (not MCP/CLI):

- SDK: [sdk.md](./sdk.md)
- HTTP: [api.md](./api.md)

Still **no API key** on hosted until billing ships.

## Agent harness (live on imtakt.dev)

Agent self-onboarding ships on the site, not in this repo:

- Harness: [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding)
- Skill: [imtakt.dev/agent-onboarding/SKILL.md](https://imtakt.dev/agent-onboarding/SKILL.md)
- Codex plugin: [imtakt.dev/agent-onboarding/codex/plugin.json](https://imtakt.dev/agent-onboarding/codex/plugin.json)

Repo copy [SKILL.md](./SKILL.md) is a reference snapshot for contributors.
