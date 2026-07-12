# Status

**Hosted API:** [api.imtakt.dev](https://api.imtakt.dev) — check `GET /health` for capability flags.

**npm packages:** `@imtakt/mcp`, `@imtakt/cli`, `@imtakt/sdk`, `@imtakt/core` at **0.2.0** — see [CHANGELOG.md](CHANGELOG.md).

**Self-host:** [imtakt-router](https://github.com/ImTakt/imtakt-router) (ImTakt Server) + [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) (feeds and stop index).

## Verify locally

```bash
bun run build && bun run test && bun run pack:smoke
bash scripts/launch-verify.sh
```
