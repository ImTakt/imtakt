# Python analytics (optional)

**Optional** stdin→stdout transforms on harness compact JSON. Core planning uses `@imtakt/sdk` — **no Python required**.

**Principle:** Enrich all viable options. **Agent decides.** Prefer compact journey facets from the harness first.

## Discover (instant, no python3)

```bash
imtakt analytics                 # full manifest (JSON when piped)
imtakt analytics use-case plan_simple
imtakt analytics path merge-journey-searches
imtakt --version                 # points at "imtakt analytics"
```

Manifest includes `domain: "transit"` and `domainsReserved: ["transit","logistics"]` for future scale-out.

## When to use Python

| Need | Use |
|------|-----|
| Compare options on one trip | Harness compact JSON (no Python) |
| Merge N time windows / ODs | `merge-journey-searches` |
| Round-trip combinations | merge → `round-trip-matrix` |
| Live / train aggregates | `live-delay-summary`, `train-summary` |
| CSV / pandas | `export-csv`, `flatten-legs`, `flatten-stops` |

## Pattern

```bash
imtakt journey "A" "B" --format json 2>/dev/null \
  | python3 "$(imtakt analytics path delay-summary)"
```

### Multi-search

```bash
imtakt journey "Home" "Office" --at "$T1" --format json 2>/dev/null > /tmp/s1.json
imtakt journey "Home" "Office" --at "$T2" --format json 2>/dev/null > /tmp/s2.json
jq -s '{searches:[
  {label:"morning", when:"'"$T1"'", result:.[0]},
  {label:"evening", when:"'"$T2"'", result:.[1]}
]}' /tmp/s1.json /tmp/s2.json \
  | python3 "$(imtakt analytics path merge-journey-searches)"
```

## Scripts

See `imtakt analytics` for the live catalog. Highlights:

- **journey:** delay-summary, flatten-legs, rank-by-delay, export-csv, filter-regio, extract-run-ids
- **multi:** merge-journey-searches, round-trip-matrix
- **live:** live-delay-summary, live-export-csv
- **train:** train-summary, flatten-stops

Stdlib only (Python 3.9+). Repo: `scripts/analytics/`. npm: `@imtakt/cli` `analytics/`.

## See also

- [agent-harness.md](./agent-harness.md) — primary path
- [agent-patterns.md](./agent-patterns.md)
