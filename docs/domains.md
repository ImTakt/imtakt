# Multi-domain agent harness

ImTakt’s agent contract is **domain-agnostic**. Transit is live today; logistics (and later domains) reuse the **same five verbs** and presentation stack — not a second CLI/MCP format layer and not “add more methods.”

## Contract (stable across domains)

| Pillar | Rule |
|--------|------|
| Verbs | `find` · `plan` · `show` · `status` · `follow` (+ `analytics`) |
| Identity | Every envelope has `schema` + `domain` |
| Channel | JSON **or** markdown — never both |
| Decision | `decisionBoundary: "agent"` — harness never picks |
| Breadth | Prefer board → expand when `capabilities.boardExpand` |
| Time | Explicit intents (`arriveBy`, `departAfter`, …) when supported |
| Fan-out | Server-side; forbid client poll storms |

See `HARNESS_PRINCIPLES` and `DOMAIN_PROFILES` in `@imtakt/core`.

## Domain profiles

```typescript
import { DOMAIN_PROFILES, createAgentHarness, createImTakt } from "@imtakt/sdk"

DOMAIN_PROFILES.transit.status   // "live"
DOMAIN_PROFILES.logistics.status // "reserved"

const harness = createAgentHarness(createImTakt(), { domain: "transit" })
harness.domain   // "transit"
harness.profile.capabilities.boardExpand // true
```

Selecting a reserved domain throws a clear error listing reserved schemas.

## Verb map

| Verb | Transit today | Logistics later |
|------|---------------|-----------------|
| `find` | stop / station | hub / depot / gate |
| `plan` | OD journey board/plan | multi-stop / lane board |
| `show` | full `plan/v1` | full logistics plan |
| `status` | station departures | shipment / hub status |
| `follow` | train `runId` | vehicle / consignment |

## Transit (live)

| Schema | Role |
|--------|------|
| `imtakt.agent.plan/v1` | Full OD plan (legs, risk) |
| `imtakt.agent.board/v1` | Thin options → `show` |
| `imtakt.agent.find/v1` | Stop resolve |
| `imtakt.agent.live/v1` | Station departures |
| `imtakt.agent.train/v1` | Run progress |

Harness: `find`, `plan`, `show`, `status`, `follow` (old names `resolvePlace` / `planTrip` / … are thin aliases for one minor version).

## Logistics (reserved)

| Schema | Intended role |
|--------|----------------|
| `imtakt.agent.logistics.plan/v1` | Multi-stop / freight plan |
| `imtakt.agent.logistics.board/v1` | Thin lane/option board |
| `imtakt.agent.logistics.find/v1` | Hub / depot / gate resolve |

**Not implemented yet.** When it lands:

1. Add a logistics client (or extend `ImTaktClient`) for freight APIs.
2. Add `compactLogistics*` producers that set `domain: "logistics"`.
3. Flip `DOMAIN_PROFILES.logistics.status` to `"live"`.
4. Implement the **same five methods** on the harness for that domain — no `createLogisticsHarness`, no new top-level CLI verbs.
5. Keep CLI/MCP presentation (`--json` / markdown) unchanged — only option shapes differ.

## Adding a third domain

1. Extend `PlanningDomain` and `DOMAIN_PROFILES`.
2. Reserve schema constants (`imtakt.agent.<domain>.*`).
3. Implement compactifiers + the five verbs for that domain.
4. Mark `status: "live"` when ready.
5. Do **not** fork the presentation stack or invent domain-specific CLI commands.

## Agent discovery

```bash
# Analytics catalog already advertises domainsReserved
imtakt analytics --json | jq '.domainsReserved'
# → ["transit","logistics"]
```

Agents should read `harness.profile` (or envelope `domain`) and branch on capabilities — never assume every domain has trains or D-Ticket.
