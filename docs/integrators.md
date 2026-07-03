# Integrators

**Adoption is agent harness, MCP, or CLI.** Use those first. This page is for app embeds, raw HTTP, and self-host.

## SDK (TypeScript apps)

See [sdk.md](./sdk.md). Package: `@imtakt/sdk` — thin client over ImTakt Server `/v1`.

No API key on the hosted free tier.

## HTTP API

See [api.md](./api.md). Base: `https://api.imtakt.dev` · OpenAPI: `GET /v1/openapi.json`.

## Self-host

Run your own stack:

- [imtakt-router](https://github.com/ImTakt/imtakt-router) — ImTakt Server + routing bootstrap
- [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) — feeds, index, harness

Set `IMTAKT_SERVER_URL` on MCP and CLI when pointing at a local or private API.

## Not on the hosted path yet

| Item | Notes |
| --- | --- |
| **API keys / login** | Billing and authenticated tiers |
| **Billing** | After public launch |
