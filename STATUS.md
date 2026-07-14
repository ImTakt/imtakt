# Status

**Hosted API:** [api.imtakt.dev](https://api.imtakt.dev) — check `GET /health` for capability flags.

**npm packages:** `@imtakt/mcp`, `@imtakt/cli`, `@imtakt/sdk`, `@imtakt/core` at **0.2.0** — see [CHANGELOG.md](CHANGELOG.md).

**Self-host:** [imtakt-router](https://github.com/ImTakt/imtakt-router) (ImTakt Server) + [imtakt-gtfs](https://github.com/ImTakt/imtakt-gtfs) (feeds and stop index).

## Publish readiness (2026-07-14)

| Check | Result |
| --- | --- |
| `bun run build` | pass |
| `bun run test` (core, sdk, mcp) | 14/14 pass |
| `bash scripts/npm-pack-smoke.sh` | pass (find, journey, live, MCP init, SSRF guards) |
| `bash scripts/launch-verify.sh` | pass (hosted API + pack smoke) |
| `python3 scripts/interface-test.py` | 8 pass, 1 fail (`GET /v1/trains/not-a-valid-r` → 400 not 404 — cosmetic) |
| npm registry | **not published** — needs `npm login` on publish machine |

## Publish

```bash
cd imtakt
npm login   # ImTakt org token with publish access
bash scripts/npm-publish.sh          # live
# bash scripts/npm-publish.sh --dry-run   # optional rehearsal
```

Order: `@imtakt/core` → `@imtakt/sdk` → `@imtakt/cli` → `@imtakt/mcp` (handled by script).

Post-publish smoke:

```bash
npx -y @imtakt/mcp --version
npx -y @imtakt/cli find "Berlin Hbf"
bash scripts/launch-verify.sh   # step 6 hits registry
```

## Verify locally

```bash
bun run build && bun run test && bun run pack:smoke
bash scripts/launch-verify.sh
```
