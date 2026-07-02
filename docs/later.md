# Shipping later

These are **not** part of the current adoption path. MCP + CLI on the hosted API ship first.

## Deferred to self-host / Phase 2+

| Item | Notes |
| --- | --- |
| **Agent self-onboarding** | Fetchable `SKILL.md`, autonomous signup flows |
| **API keys / login** | Billing and authenticated tiers |
| **`@imtakt/sdk`** | App embeds — see [sdk.md](./sdk.md) when you need it |
| **Raw HTTP cookbook** | [api.md](./api.md) |
| **Self-host compose** | [imtakt-router](https://github.com/ImTakt/imtakt-router) + [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) |

## For integrators today

If you must call HTTP or TypeScript directly (not MCP/CLI):

- SDK: [sdk.md](./sdk.md)
- HTTP: [api.md](./api.md)

Still **no API key** on hosted until billing ships.

## Draft agent skill (not promoted yet)

A draft skill file exists at [SKILL.md](./SKILL.md) for future agent onboarding. Do not link it from marketing until self-host GA.
