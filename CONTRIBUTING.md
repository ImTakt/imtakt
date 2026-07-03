# Contributing to ImTakt

Thanks for helping improve the **adoption surface** (MCP, SDK, CLI) and docs.

## Repos

| Repo | Contribute |
| --- | --- |
| **imtakt** (here) | MCP, SDK, CLI, docs |
| **imtakt-router** | ImTakt Server `/v1` |
| **imtakt-gtfs** | Feeds and stop index |
| **imtakt-docs** | Extended documentation |

## Development

```bash
git clone https://github.com/ImTakt/imtakt.git
cd imtakt && bun install
bun run build
bun run test
bun run pack:smoke   # simulates npx install path vs api.imtakt.dev
```

Local API (full stack): see [imtakt-router LOCALDEV](https://github.com/ImTakt/imtakt-router/blob/main/LOCALDEV.md).

```bash
export IMTAKT_SERVER_URL=http://localhost:3011
```

## Pull requests

1. One concern per PR when possible (docs vs code).
2. Keep public copy free of internal stack or ops names.
3. Match existing TypeScript style; run `bun run typecheck`.
4. Update [docs/](./docs/) when changing MCP tools or SDK methods.

## Publishing (maintainers)

After `api.imtakt.dev` health is green:

```bash
npm login
bash scripts/npm-publish.sh
bash scripts/npm-publish.sh --dry-run   # optional rehearsal
```

Packages publish in order: `@imtakt/core` → `@imtakt/sdk` → `@imtakt/cli` → `@imtakt/mcp`.

**Security:** clients ship no secrets; `IMTAKT_SERVER_URL` is validated (no credentials, blocked metadata hosts). See `packages/core/src/resolve-base-url.ts`.

## Questions

Open an issue on [github.com/ImTakt/imtakt](https://github.com/ImTakt/imtakt/issues).
