# Agent patterns

Recipes using the **agent harness** (`@imtakt/sdk`) or **CLI**. Prefer time-first **plan → show → follow**. Foundation: [agent-intelligence.md](./agent-intelligence.md) · [HARNESS.md](./HARNESS.md).

## 1. Office commute (time-first)

```bash
imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \
  --arrive 08:00 --date 2026-07-20 --fare d-ticket --nearby --view board --json
```

Read `meta.latestSafeOptionId` / tags `latest_safe` and `arriveSlackMinutes`. Then:

```bash
imtakt show <optionId> --json
```

## 2. D-Ticket / regio

```bash
imtakt plan "A" "B" --fare d-ticket --nearby --view board --window 120m --json
```

Empty board → check `warnings` + `alternatives.fasterWithSurcharge` (do not silently drop `--fare`).

## 3. Morning vs evening (one call)

```bash
imtakt plan "A" "B" --pack windows --windows "06:00+120m,17:00+120m" \
  --fare d-ticket --view board --json
```

## 4. Round trip

```bash
imtakt plan "A" "B" --pack round-trip \
  --arrive 09:00 --return-after 17:30 --dwell 30m --fare d-ticket --view board --json
```

## 5. Day chain A→B→C

```bash
imtakt plan --pack day-chain --stops "Messe,München Hbf,Gräfelfing" \
  --dwell 45m --fare d-ticket --view board --json
```

## 6. Status + follow drill-down

```bash
imtakt status "Berlin Hbf" --json
# From expanded plan legs:
imtakt follow "$RUN_ID" --json
```

## 7. Time grounding

```bash
# Berlin local composed with --date
imtakt plan "A" "B" --arrive 08:00 --date 2026-07-20 --view board --json

# Relative / ISO
WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
imtakt plan "A" "B" --at "$WHEN" --window 90m --view board --json
```

## Anti-patterns

- Looping `--at` every 3–5 minutes × origins
- Full `plan/v1` on every probe (use `--view board` first)
- Manual Messe Süd/Nord re-queries (use `--nearby`)
- Client stitch logic (server hub-stitches when regio is sparse)

Advanced offline transforms: `imtakt analytics use-case compare_time_windows` (prefer `--pack windows`).
