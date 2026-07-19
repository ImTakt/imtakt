# Status

**Where we are:** domain-neutral agent harness — five verbs for transit today; logistics reserved on the same surface.

| Verb | Transit | Logistics (later) |
|------|---------|-------------------|
| `find` | stop / station | hub / depot |
| `plan` | OD board / full plan | lane / multi-stop board |
| `show` | expand `optionId` → `plan/v1` | expand logistics option |
| `status` | station live | hub / shipment status |
| `follow` | train `runId` | vehicle / consignment |

**Flow for agents:** `plan` (board) → `show` → `follow`. Never dense `--at` poll loops.

**Hosted API:** [api.imtakt.dev](https://api.imtakt.dev) — `GET /health`, `GET /v1/meta`.

**npm (patch ready):** `@imtakt/{mcp,cli,sdk,core}` **0.3.2** — [CHANGELOG.md](CHANGELOG.md).

**Docs SSOT:** [HARNESS.md](docs/HARNESS.md) · [domains.md](docs/domains.md) · [cli.md](docs/cli.md) · [agent-harness.md](docs/agent-harness.md)

## Verify

```bash
bun run build
bun run pack:smoke
bun run accept:planning
bash scripts/launch-verify.sh
```

## Publish

```bash
bash scripts/npm-publish.sh --dry-run   # optional
bash scripts/npm-publish.sh
```

## Smoke (after publish)

```bash
npx -y @imtakt/cli@0.3.2 plan "Berlin Hbf" "München Hbf" --view board --json | jq .schema
```
