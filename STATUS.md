# Status

**Hosted API:** [api.imtakt.dev](https://api.imtakt.dev) — check `GET /health` and `GET /v1/meta` for capability flags.

**npm packages:** `@imtakt/mcp`, `@imtakt/cli`, `@imtakt/sdk`, `@imtakt/core` at **0.3.0** — see [CHANGELOG.md](CHANGELOG.md).

**Agent harness:** [docs/agent-harness.md](docs/agent-harness.md) — `createAgentHarness()` in `@imtakt/sdk`.

## Verify locally

```bash
bun run build && bun run test && bun run pack:smoke
bash scripts/launch-verify.sh
```

## Publish

```bash
bash scripts/npm-publish.sh
npx -y @imtakt/cli@0.3.0 journey "Berlin Hbf" "München Hbf" --format md
```
