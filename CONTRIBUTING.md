# Contributing to ImTakt

Thanks for helping improve the **adoption surface** (MCP, SDK, CLI) and docs.

## Repos

| Repo | Contribute |
| --- | --- |
| **imtakt** (here) | MCP, SDK, CLI, docs |
| **imtakt-router** | ImTakt Server `/v1` |
| **imtakt-gtfs** | Transit engine + feeds |
| **imtakt-docs** | Extended documentation |
| **imtakt** | Strategy (markdown only) |

## Development

```bash
git clone https://github.com/ImTakt/imtakt.git
cd imtakt && bun install
bun run typecheck
```

Local API (optional):

```bash
# Sibling repos
cd ../imtakt-gtfs && docker compose up meilisearch -d && bun run feeds:refresh
cd ../imtakt-router && bash scripts/dev-api.sh
export IMTAKT_SERVER_URL=http://localhost:3011
```

## Pull requests

1. One concern per PR when possible (docs vs code).
2. Keep public copy free of internal stack names (Meilisearch, MOTIS, etc.).
3. Match existing TypeScript style; run `bun run typecheck`.
4. Update [docs/](./docs/) when changing MCP tools or SDK methods.

## Publishing (maintainers)

After `api.imtakt.dev` health is green:

```bash
npm login
bash scripts/npm-publish.sh
```

## Questions

Open an issue on [github.com/ImTakt/imtakt](https://github.com/ImTakt/imtakt/issues).
