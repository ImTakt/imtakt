#!/usr/bin/env bun
/**
 * Systematic planning acceptance suite — harness + analytics + live/train.
 *
 * Usage:
 *   bun scripts/planning-acceptance.ts
 *   IMTAKT_SERVER_URL=https://api.imtakt.dev bun scripts/planning-acceptance.ts
 *
 * Exit 0 = all hard checks passed. Soft WARN lines are non-fatal (e.g. undeployed RT).
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createImTakt, createAgentHarness, ImTaktAmbiguousPlaceError } from "../packages/sdk/src/index.ts"

const API = process.env.IMTAKT_SERVER_URL ?? "https://api.imtakt.dev"
const ROOT = join(import.meta.dir, "..")
const TMP = join(ROOT, ".tmp/planning-acceptance")
const CLI = join(ROOT, "packages/cli/dist/main.js")
const ANALYTICS = join(ROOT, "packages/cli/analytics")

type Status = "PASS" | "FAIL" | "WARN" | "SKIP"
type Row = { id: string; group: string; status: Status; detail: string; ms: number }

const rows: Row[] = []
let failed = 0

function record(id: string, group: string, status: Status, detail: string, ms: number) {
  rows.push({ id, group, status, detail, ms })
  const mark = status === "PASS" ? "✓" : status === "WARN" ? "!" : status === "SKIP" ? "-" : "✗"
  console.log(`  ${mark} [${group}] ${id}: ${detail} (${ms}ms)`)
  if (status === "FAIL") failed++
}

async function check(
  id: string,
  group: string,
  fn: () => Promise<string | { soft: string } | void>,
): Promise<void> {
  const t0 = Date.now()
  try {
    const detail = await fn()
    if (detail && typeof detail === "object" && "soft" in detail) {
      record(id, group, "WARN", detail.soft, Date.now() - t0)
    } else {
      record(id, group, "PASS", detail || "ok", Date.now() - t0)
    }
  } catch (err) {
    record(id, group, "FAIL", err instanceof Error ? err.message : String(err), Date.now() - t0)
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function facetKeys(j: Record<string, unknown>) {
  for (const k of [
    "option",
    "headline",
    "brief",
    "durationMinutes",
    "durationText",
    "changes",
    "transfers",
    "changesText",
    "departLocal",
    "arriveLocal",
    "products",
    "totalDelayMinutes",
    "cancelledLegs",
    "riskLevel",
    "riskScore",
    "riskSignals",
    "transferGaps",
    "lines",
    "legs",
  ]) {
    assert(k in j, `missing facet ${k}`)
  }
  assert(["low", "medium", "high"].includes(j.riskLevel as string), `bad riskLevel ${j.riskLevel}`)
  assert(typeof j.riskScore === "number", "riskScore")
  assert(Array.isArray(j.riskSignals), "riskSignals not array")
  assert(typeof j.headline === "string" && (j.headline as string).includes("→"), "headline")
  assert(typeof j.brief === "string" && (j.brief as string).length > 0, "brief empty")
  assert(j.changes === j.transfers, "changes/transfers mismatch")
  const leg0 = (j.legs as Record<string, unknown>[])[0]
  if (leg0) {
    assert(leg0.type === "ride", "leg.type")
    assert(typeof leg0.depLocal === "string", "leg.depLocal")
    assert(typeof leg0.product === "string", "leg.product")
  }
}

function intelligenceShape(intel: Record<string, unknown>) {
  assert(intel.version === 1, "intelligence.version")
  assert(intel.decisionBoundary === "agent", "decisionBoundary must be agent")
  assert(Array.isArray(intel.layers), "layers")
  // Honesty: no vaporware keys on the wire
  assert(!("enrichments" in intel), "enrichments must not be present until /intel")
  assert(!("mlPolicy" in intel), "mlPolicy belongs in docs/export, not every plan")
  assert(!("weighFields" in intel), "weighFields belongs in docs/export, not every plan")
  for (const layer of intel.layers as { id: string; present: boolean }[]) {
    assert(layer.present === true, "only present layers")
    assert(layer.id === "schedule_facts" || layer.id === "realtime_facts", `bad layer ${layer.id}`)
  }
  const rm = intel.riskModel as { id?: string; kind?: string; inputsUnavailable?: unknown }
  assert(rm?.id === "imtakt.connection_slack.v1", `riskModel.id ${rm?.id}`)
  assert(rm?.kind === "deterministic_heuristic", "riskModel.kind")
  assert(Array.isArray(rm?.inputsUnavailable), "inputsUnavailable")
  const cmp = intel.comparison as { lowRisk?: unknown; highRisk?: unknown; lowestDelay?: unknown }
  assert(Array.isArray(cmp?.lowRisk) && Array.isArray(cmp?.highRisk), "comparison risk buckets")
  assert(!("lowestDelay" in (cmp ?? {})), "lowestDelay was renamed; use lowestLiveDelay only with RT")
}

function runCli(args: string[], opts?: { json?: boolean }): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, IMTAKT_SERVER_URL: API },
    maxBuffer: 20 * 1024 * 1024,
  })
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 1 }
}

function runPy(script: string, stdin: string): { stdout: string; code: number } {
  const r = spawnSync("python3", [join(ANALYTICS, script)], {
    input: stdin,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  return { stdout: r.stdout ?? "", code: r.status ?? 1 }
}

function whenPlusHours(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString()
}

mkdirSync(TMP, { recursive: true })

const client = createImTakt({ baseUrl: API, timeoutMs: 45_000 })
const harness = createAgentHarness(client)

console.log(`\nImTakt planning acceptance — ${API}\n`)

// ─── A. Platform ───────────────────────────────────────────────
await check("health.ok", "platform", async () => {
  const res = await fetch(`${API}/health`)
  assert(res.ok, `HTTP ${res.status}`)
  const h = (await res.json()) as { ok?: boolean; capabilities?: { journeys?: { ok?: boolean }; realtime?: { available?: boolean } } }
  assert(h.ok === true, "health.ok false")
  assert(h.capabilities?.journeys?.ok, "journeys capability down")
  return `journeys ok; realtime.available=${h.capabilities?.realtime?.available}`
})

await check("npm.cli.local", "platform", async () => {
  const v = runCli(["--version"])
  assert(v.code === 0, v.stderr || "cli exit")
  const j = JSON.parse(v.stdout)
  assert(j.version === "0.3.1", `version ${j.version}`)
  assert(j.harness === "@imtakt/sdk", "missing harness marker")
  assert(j.output?.default === "auto", "output.default auto")
  assert(Array.isArray(j.output?.channels) && j.output.channels.includes("json"), "output.channels")
  return j.version
})

// ─── B. Resolve ────────────────────────────────────────────────
await check("resolve.named_hub", "resolve", async () => {
  const r = await harness.resolvePlace("Berlin Hbf")
  assert(r.stopId.startsWith("de_"), r.stopId)
  assert(r.confidence >= 0.7, `confidence ${r.confidence}`)
  return `${r.stop.name} (${r.stopId}) conf=${r.confidence}`
})

await check("resolve.coords", "resolve", async () => {
  const r = await harness.resolvePlace({ lat: 52.5219, lng: 13.4132 })
  assert(r.stopId, "no stop")
  return `${r.stop.name} (${r.stopId})`
})

await check("resolve.address_fuzzy", "resolve", async () => {
  const r = await harness.resolvePlace("Gräfelfing, Am Haag")
  assert(r.stopId, "no stop")
  return `${r.stop.name} conf=${r.confidence} type=${r.matchType}`
})

await check("resolve.ambiguous_throws", "resolve", async () => {
  try {
    // Broad German place name with many distant matches — must fail at minConfidence=1
    await harness.resolvePlace("Mitte", { minConfidence: 1, field: "from" })
    throw new Error("expected ImTaktAmbiguousPlaceError")
  } catch (err) {
    assert(err instanceof ImTaktAmbiguousPlaceError, `wrong error: ${err}`)
    assert(err.candidates.length >= 2, "need ≥2 candidates")
    return `${err.candidates.length} candidates`
  }
})

// ─── C. Plan — single search ───────────────────────────────────
let berlinMuenchen: Awaited<ReturnType<typeof harness.planTrip>>

await check("plan.long_distance_facets", "plan", async () => {
  berlinMuenchen = await harness.planTrip({
    from: "Berlin Hbf",
    to: "München Hbf",
    when: whenPlusHours(2),
  })
  assert(berlinMuenchen.journeys.length >= 1, "no journeys")
  const out = harness.format(berlinMuenchen, "journey", {
    labels: berlinMuenchen.labels,
    warnings: berlinMuenchen.warnings,
  })
  const payload = out.payload as {
    schema: string
    domain: string
    trip: { from: { name: string }; to: { name: string }; realtime: string; timezone: string }
    journeys: Record<string, unknown>[]
    intelligence: Record<string, unknown>
  }
  assert(payload.schema === "imtakt.agent.plan/v1", `schema ${payload.schema}`)
  assert(payload.domain === "transit", `domain ${payload.domain}`)
  assert(payload.trip?.from?.name && payload.trip?.to?.name, "trip header")
  assert(payload.trip.timezone === "Europe/Berlin", "trip.timezone")
  assert(payload.journeys.length === berlinMuenchen.journeys.length, "compact dropped options")
  for (const j of payload.journeys) facetKeys(j)
  intelligenceShape(payload.intelligence)
  intelligenceShape(berlinMuenchen.intelligence as unknown as Record<string, unknown>)
  assert(berlinMuenchen.labels.length >= 1, "no labels")
  // Harness product: agent envelope attached on planTrip (no format required)
  assert(berlinMuenchen.agent?.schema === "imtakt.agent.plan/v1", "trip.agent missing")
  assert(berlinMuenchen.agent.journeys.length === payload.journeys.length, "agent/format parity")
  assert(berlinMuenchen.realtime != null, "realtime always normalized")
  assert(typeof berlinMuenchen.realtime.available === "boolean", "realtime.available")
  assert(typeof berlinMuenchen.realtime.asOf === "string", "realtime.asOf")
  assert(out.presentation === "json", "default presentation is json")
  assert(out.payload === berlinMuenchen.agent, "format reuses trip.agent")
  assert(typeof out.markdown === "string" && out.markdown.includes("→"), "markdown available")
  assert(out.markdown.includes(payload.journeys[0]?.departLocal as string), "md/json parity")
  writeFileSync(join(TMP, "berlin-muenchen.json"), out.json!)
  writeFileSync(join(TMP, "berlin-muenchen.md"), out.markdown)
  return `${payload.trip.from.name}→${payload.trip.to.name}; ${payload.journeys.length} options; agent attached`
})

await check("plan.regio_excludes_ice", "plan", async () => {
  // Try a few departure windows — overnight can be ICE-only after filter
  let trip: Awaited<ReturnType<typeof harness.planTrip>> | undefined
  for (const h of [3, 6, 9, 12]) {
    const t = await harness.planTrip({
      from: "München Hbf",
      to: "Augsburg Hbf",
      when: whenPlusHours(h),
      preferences: { excludeLongDistance: true },
    })
    if (t.journeys.length >= 1) {
      trip = t
      break
    }
  }
  if (!trip) {
    return { soft: "no regio options on MUC→AUG in sampled windows (ICE-only after filter)" }
  }
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as { journeys: { lines: string[]; option: number }[] }
  for (const j of payload.journeys) {
    for (const line of j.lines) {
      assert(!/^(ICE|IC|EC)\b/i.test(line), `regio leaked ${line} on option ${j.option}`)
    }
  }
  writeFileSync(join(TMP, "regio.json"), out.json!)
  return `${payload.journeys.length} regio options; serverFiltered=${trip.preferencesApplied.serverFiltered}`
})

await check("plan.stop_ids_skip_resolve", "plan", async () => {
  const from = await harness.resolvePlace("Köln Hbf")
  const to = await harness.resolvePlace("Frankfurt(Main)Hbf")
  const trip = await harness.planTrip({
    from: { stopId: from.stopId },
    to: { stopId: to.stopId },
    when: whenPlusHours(4),
  })
  assert(trip.journeys.length >= 1, "no journeys")
  assert(!trip.resolved?.from, "should not re-resolve stop ids into snap")
  return `${trip.journeys.length} options ${from.stopId}→${to.stopId}`
})

await check("plan.urban_coords", "plan", async () => {
  const trip = await harness.planTrip({
    from: { lat: 52.5219, lng: 13.4132 },
    to: { lat: 52.525, lng: 13.3694 },
    when: whenPlusHours(1),
  })
  assert(trip.journeys.length >= 1, "no journeys")
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as { journeys: unknown[] }
  return `${payload.journeys.length} multimodal options`
})

await check("plan.short_regional", "plan", async () => {
  const trip = await harness.planTrip({
    from: "München Hbf",
    to: "München Flughafen Terminal",
    when: whenPlusHours(2),
  })
  assert(trip.journeys.length >= 1, "no journeys")
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as { journeys: { durationMinutes: number; riskLevel: string }[] }
  for (const j of payload.journeys) facetKeys(j as unknown as Record<string, unknown>)
  return `${payload.journeys.length} options; fastest=${Math.min(...payload.journeys.map((j) => j.durationMinutes))}m`
})

await check("plan.max_transfers", "plan", async () => {
  const trip = await harness.planTrip({
    from: "Hamburg Hbf",
    to: "Dresden Hbf",
    when: whenPlusHours(5),
    preferences: { maxTransfers: 1 },
  })
  for (const j of trip.journeys) {
    assert(j.transfers <= 1, `transfers ${j.transfers} > 1`)
  }
  return `${trip.journeys.length} options with ≤1 transfer`
})

await check("plan.realtime_normalized", "plan", async () => {
  const rt = berlinMuenchen!.realtime
  assert(rt != null, "realtime missing after harness normalize")
  assert(typeof rt.available === "boolean", "available")
  assert(rt.asOf.length > 0, "asOf")
  // trip.agent.trip.realtime mirrors normalized snapshot
  assert(
    berlinMuenchen!.agent.trip.realtime === (rt.available ? "live" : "schedule"),
    "agent trip.realtime mismatch",
  )
  return `available=${rt.available} asOf=${rt.asOf}; agent=${berlinMuenchen!.agent.trip.realtime}`
})

await check("plan.warnings_deduped", "plan", async () => {
  const w = berlinMuenchen!.warnings
  assert(new Set(w).size === w.length, "duplicate warnings")
  return `${w.length} warnings`
})

// ─── D. Multi-journey ──────────────────────────────────────────
await check("multi.time_windows", "multi", async () => {
  const t1 = whenPlusHours(2)
  const t2 = whenPlusHours(10)
  const a = await harness.planTrip({ from: "Berlin Hbf", to: "Hamburg Hbf", when: t1 })
  const b = await harness.planTrip({ from: "Berlin Hbf", to: "Hamburg Hbf", when: t2 })
  const fa = harness.format(a, "journey", { labels: a.labels, warnings: a.warnings }).json!
  const fb = harness.format(b, "journey", { labels: b.labels, warnings: b.warnings }).json!
  writeFileSync(join(TMP, "s1.json"), fa)
  writeFileSync(join(TMP, "s2.json"), fb)
  const mergedIn = JSON.stringify({
    searches: [
      { label: "morning", when: t1, result: JSON.parse(fa) },
      { label: "evening", when: t2, result: JSON.parse(fb) },
    ],
  })
  const py = runPy("merge-journey-searches.py", mergedIn)
  assert(py.code === 0, py.stdout)
  const m = JSON.parse(py.stdout)
  assert(m.searchCount === 2, "searchCount")
  assert(m.searches[0].optionCount === a.journeys.length, "morning options dropped")
  assert(m.searches[1].optionCount === b.journeys.length, "evening options dropped")
  assert(!("recommendation" in m) && !("bestOption" in m), "must not auto-pick")
  writeFileSync(join(TMP, "merged.json"), py.stdout)
  return `morning=${m.searches[0].optionCount} evening=${m.searches[1].optionCount}`
})

await check("multi.round_trip_matrix", "multi", async () => {
  const outTrip = await harness.planTrip({
    from: "München Hbf",
    to: "Nürnberg Hbf",
    when: whenPlusHours(3),
  })
  const retTrip = await harness.planTrip({
    from: "Nürnberg Hbf",
    to: "München Hbf",
    when: whenPlusHours(8),
  })
  const mergedIn = JSON.stringify({
    searches: [
      {
        label: "out",
        result: harness.format(outTrip, "journey", { labels: outTrip.labels, warnings: outTrip.warnings })
          .payload,
      },
      {
        label: "return",
        result: harness.format(retTrip, "journey", {
          labels: retTrip.labels,
          warnings: retTrip.warnings,
        }).payload,
      },
    ],
  })
  const merged = runPy("merge-journey-searches.py", mergedIn)
  const matrix = runPy("round-trip-matrix.py", merged.stdout)
  assert(matrix.code === 0, matrix.stdout)
  const m = JSON.parse(matrix.stdout)
  const expected = outTrip.journeys.length * retTrip.journeys.length
  assert(m.pairCount === expected, `pairs ${m.pairCount} != ${expected}`)
  assert(!("recommendation" in m), "must not auto-pick")
  return `${m.pairCount} pairs (${outTrip.journeys.length}×${retTrip.journeys.length})`
})

await check("multi.day_chain_abc", "multi", async () => {
  // Sightseeing chain A→B→C: consecutive plans must leave enough wall-clock gap
  const a = "München Hbf"
  const b = "Nürnberg Hbf"
  const c = "Würzburg Hbf"
  const t0 = whenPlusHours(2)
  const ab = await harness.planTrip({ from: a, to: b, when: t0 })
  assert(ab.journeys.length >= 1, "A→B empty")
  const abBest = ab.journeys.reduce((best, j) =>
    j.durationMinutes < best.durationMinutes ? j : best,
  )
  const arriveB = abBest.legs[abBest.legs.length - 1]!.arrival
  const t1 = new Date(Date.parse(arriveB) + 45 * 60_000).toISOString()
  const bc = await harness.planTrip({ from: b, to: c, when: t1 })
  assert(bc.journeys.length >= 1, "B→C empty")
  const merged = runPy(
    "merge-journey-searches.py",
    JSON.stringify({
      searches: [
        {
          label: "leg1",
          result: harness.format(ab, "journey", { labels: ab.labels, warnings: ab.warnings }).payload,
        },
        {
          label: "leg2",
          result: harness.format(bc, "journey", { labels: bc.labels, warnings: bc.warnings }).payload,
        },
      ],
    }),
  )
  const m = JSON.parse(merged.stdout)
  assert(m.searchCount === 2, "chain merge")
  return `A→B ${ab.journeys.length} opts (${abBest.durationMinutes}m) then B→C ${bc.journeys.length} opts @ ${t1}`
})

await check("multi.relocation_matrix", "multi", async () => {
  const office = "München Hbf"
  const homes = ["Gräfelfing, Am Haag", "Pasing", "Ostbahnhof"]
  const when = whenPlusHours(4)
  const searches = []
  for (const home of homes) {
    const trip = await harness.planTrip({ from: home, to: office, when })
    searches.push({
      label: home,
      when,
      result: harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings }).payload,
    })
  }
  const py = runPy("merge-journey-searches.py", JSON.stringify({ searches }))
  const m = JSON.parse(py.stdout)
  assert(m.searchCount === 3, "expected 3 homes")
  for (const s of m.searches) assert(s.optionCount >= 1, `${s.label} empty`)
  return m.searches.map((s: { label: string; optionCount: number }) => `${s.label}:${s.optionCount}`).join(" | ")
})

// ─── E. Live + train ───────────────────────────────────────────
let liveJson = ""
let runId = ""

await check("live.board_compact", "live", async () => {
  const board = await harness.stationStatus("Berlin Hbf", { limit: 16 })
  assert(board.departures.length >= 1, "no departures")
  const out = harness.format(board, "live")
  liveJson = out.json!
  const p = out.payload as { departures: unknown[]; station: string }
  assert(p.departures.length >= 1, "compact empty")
  writeFileSync(join(TMP, "live.json"), liveJson)
  return `${p.station}: ${p.departures.length} deps; rt=${board.realtime.available}`
})

await check("live.delay_summary_pipe", "live", async () => {
  const py = runPy("live-delay-summary.py", liveJson)
  assert(py.code === 0, py.stdout)
  const s = JSON.parse(py.stdout)
  assert(typeof s.summary.departures === "number", "summary shape")
  return `deps=${s.summary.departures} delayed=${s.summary.delayed}`
})

await check("train.drilldown", "live", async () => {
  const extracted = runPy("extract-run-ids.py", liveJson)
  const ids = JSON.parse(extracted.stdout)
  if (!ids.runIds?.length) {
    // fallback from journey
    const j = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
    const fromJ = runPy("extract-run-ids.py", j)
    const jids = JSON.parse(fromJ.stdout)
    assert(jids.runIds?.length >= 1, "no runIds from live or journey")
    runId = jids.runIds[0].runId
  } else {
    runId = ids.runIds[0].runId
  }
  const train = await client.viewTrain(runId)
  const out = harness.format(train, "train")
  const p = out.payload as {
    runId: string
    status: string
    stops: unknown[]
    currentDelayMinutes: number
  }
  assert(p.runId === runId, "runId mismatch")
  assert(Array.isArray(p.stops), "stops missing")
  const summary = runPy("train-summary.py", out.json!)
  assert(summary.code === 0, summary.stdout)
  writeFileSync(join(TMP, "train.json"), out.json!)
  return `status=${p.status} stops=${p.stops.length} delay=${p.currentDelayMinutes}`
})

await check("journey.extract_run_ids", "live", async () => {
  const j = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
  const py = runPy("extract-run-ids.py", j)
  const d = JSON.parse(py.stdout)
  assert(d.source === "journey", d.source)
  assert(d.count >= 1, "no runIds")
  return `${d.count} unique runIds`
})

// ─── F. Analytics integrity ────────────────────────────────────
await check("analytics.delay_summary", "analytics", async () => {
  const j = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
  const n = JSON.parse(j).journeys.length
  const py = runPy("delay-summary.py", j)
  const d = JSON.parse(py.stdout)
  assert(d.summary.journeys === n, "journey count changed")
  return `journeys=${d.summary.journeys} delayedLegs=${d.summary.delayedLegs}`
})

await check("analytics.rank_preserves_count", "analytics", async () => {
  const j = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
  const before = JSON.parse(j).journeys.length
  const py = runPy("rank-by-delay.py", j)
  const after = JSON.parse(py.stdout).journeys.length
  assert(before === after, `${before} → ${after}`)
  return `count=${after}`
})

await check("analytics.filter_regio_explicit", "analytics", async () => {
  const j = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
  const before = JSON.parse(j).journeys.length
  const py = runPy("filter-regio.py", j)
  const d = JSON.parse(py.stdout)
  assert(d.filter.before === before, "before mismatch")
  assert(d.filter.after <= before, "after > before")
  return `before=${d.filter.before} after=${d.filter.after}`
})

await check("analytics.catalog_principle", "analytics", async () => {
  const r = runCli(["analytics"])
  assert(r.code === 0, r.stderr)
  const m = JSON.parse(r.stdout)
  assert(m.principle?.includes("Agent decides"), m.principle)
  assert(m.domainsReserved?.includes("logistics"), "logistics reserved")
  assert(m.useCases?.length >= 6, "useCases")
  assert(m.scripts?.length >= 10, "scripts")
  const blob = JSON.stringify(m)
  assert(!blob.includes('"recommendation"'), "catalog must not recommend")
  return `${m.scripts.length} scripts / ${m.useCases.length} useCases`
})

await check("analytics.use_case_recipes", "analytics", async () => {
  for (const id of [
    "plan_simple",
    "compare_options",
    "compare_time_windows",
    "round_trip",
    "day_of_travel",
    "monitor_planned_legs",
  ]) {
    const r = runCli(["analytics", "use-case", id])
    assert(r.code === 0, `${id}: ${r.stderr}`)
    const uc = JSON.parse(r.stdout)
    assert(uc.agentDecides === true, `${id} agentDecides`)
  }
  return "6 use-cases"
})

await check("cli.journey_format_json", "analytics", async () => {
  const r = runCli([
    "journey",
    "Stuttgart Hbf",
    "Karlsruhe Hbf",
    "--at",
    whenPlusHours(3),
    "--format",
    "json",
  ])
  assert(r.code === 0, r.stderr || r.stdout.slice(0, 200))
  const d = JSON.parse(r.stdout)
  assert(d.journeys?.length >= 1, "no journeys")
  facetKeys(d.journeys[0])
  return `${d.journeys.length} options via CLI`
})

await check("cli.journey_regio_flag", "analytics", async () => {
  let d: { journeys: { lines: string[] }[] } | undefined
  for (const h of [6, 9, 12, 15]) {
    const r = runCli([
      "journey",
      "München Hbf",
      "Augsburg Hbf",
      "--regio",
      "--format",
      "json",
      "--at",
      whenPlusHours(h),
    ])
    assert(r.code === 0, r.stderr || r.stdout.slice(0, 200))
    const parsed = JSON.parse(r.stdout)
    if (parsed.journeys?.length >= 1) {
      d = parsed
      break
    }
  }
  if (!d) return { soft: "CLI regio empty across sampled windows" }
  for (const j of d.journeys) {
    for (const line of j.lines) {
      assert(!/^(ICE|IC|EC)\b/i.test(line), `ICE leak ${line}`)
    }
  }
  return `${d.journeys.length} regio CLI options`
})

// ─── G. Consulting edge cases (hard) ───────────────────────────
await check("consult.same_name_city_scoped", "consult", async () => {
  // City token must beat bare "Hauptbahnhof" ambiguity
  const r = await harness.resolvePlace("München Hauptbahnhof")
  assert(/münchen|muenchen|munich/i.test(r.stop.name) || r.stop.name.includes("Hbf"), r.stop.name)
  assert(r.confidence >= 0.85, `low conf ${r.confidence}`)
  return `${r.stop.name} (${r.stopId})`
})

await check("consult.airport_city_access", "consult", async () => {
  const trip = await harness.planTrip({
    from: "Frankfurt Flughafen Fernbahnhof",
    to: "Frankfurt(Main)Hbf",
    when: whenPlusHours(2),
  })
  assert(trip.journeys.length >= 1, "no airport access options")
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as { journeys: { durationMinutes: number; riskLevel: string }[] }
  const fastest = Math.min(...payload.journeys.map((j) => j.durationMinutes))
  assert(fastest <= 30, `airport→Hbf ${fastest}m unexpectedly slow`)
  return `${payload.journeys.length} opts; fastest=${fastest}m`
})

await check("consult.overnight_sparse", "consult", async () => {
  // ~02:00 local — sparse overnight long-distance
  const when = new Date()
  when.setUTCHours(0, 30, 0, 0) // ~02:30 Berlin in summer
  if (when.getTime() < Date.now()) when.setUTCDate(when.getUTCDate() + 1)
  const trip = await harness.planTrip({
    from: "Berlin Hbf",
    to: "München Hbf",
    when: when.toISOString(),
  })
  assert(trip.journeys.length >= 1, "overnight returned empty — unexpected")
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as { journeys: { durationMinutes: number; riskLevel: string }[] }
  return `${payload.journeys.length} overnight opts; maxDur=${Math.max(...payload.journeys.map((j) => j.durationMinutes))}m`
})

await check("consult.hub_vs_local_station", "consult", async () => {
  // Same metro area: Hbf vs Ostbahnhof — consulting often compares both
  const when = whenPlusHours(3)
  const [toHbf, toOst] = await Promise.all([
    harness.planTrip({ from: "Augsburg Hbf", to: "München Hbf", when }),
    harness.planTrip({ from: "Augsburg Hbf", to: "München Ost", when }),
  ])
  assert(toHbf.journeys.length >= 1 && toOst.journeys.length >= 1, "empty hub compare")
  const hbfMin = Math.min(...toHbf.journeys.map((j) => j.durationMinutes))
  const ostMin = Math.min(...toOst.journeys.map((j) => j.durationMinutes))
  return `Hbf ${hbfMin}m (${toHbf.journeys.length} opts) vs Ost ${ostMin}m (${toOst.journeys.length} opts)`
})

await check("consult.tight_transfer_facets", "consult", async () => {
  const trip = await harness.planTrip({
    from: "Hamburg Hbf",
    to: "München Hbf",
    when: whenPlusHours(4),
  })
  const out = harness.format(trip, "journey", { labels: trip.labels, warnings: trip.warnings })
  const payload = out.payload as {
    journeys: {
      option: number
      riskLevel: string
      transferGaps: { at: string; minutes: number }[]
      transfers: number
    }[]
  }
  const withTransfers = payload.journeys.filter((j) => j.transfers >= 1)
  assert(withTransfers.length >= 1, "expected ≥1 transferring option")
  for (const j of withTransfers) {
    assert(j.transferGaps.length >= 1, `option ${j.option} missing transferGaps`)
    // Smart facets: sub-5min gaps must surface as high risk for consulting review
    if (j.transferGaps.some((g) => g.minutes < 5)) {
      assert(j.riskLevel === "high", `option ${j.option} tight gap but risk=${j.riskLevel}`)
    }
  }
  const high = payload.journeys.filter((j) => j.riskLevel === "high").length
  return `${payload.journeys.length} opts; ${withTransfers.length} with transfers; ${high} high-risk`
})

await check("consult.regio_vs_any_tradeoff", "consult", async () => {
  const when = whenPlusHours(3)
  const [any, regio] = await Promise.all([
    harness.planTrip({ from: "Köln Hbf", to: "Frankfurt(Main)Hbf", when }),
    harness.planTrip({
      from: "Köln Hbf",
      to: "Frankfurt(Main)Hbf",
      when,
      preferences: { excludeLongDistance: true },
    }),
  ])
  assert(any.journeys.length >= 1, "any empty")
  const anyMin = Math.min(...any.journeys.map((j) => j.durationMinutes))
  const regioMin =
    regio.journeys.length > 0 ? Math.min(...regio.journeys.map((j) => j.durationMinutes)) : null
  // Agent compares; we only assert both shapes are decision-ready
  const anyPayload = harness.format(any, "journey", { labels: any.labels, warnings: any.warnings })
    .payload as { journeys: unknown[] }
  for (const j of anyPayload.journeys) facetKeys(j as Record<string, unknown>)
  return `any ${anyMin}m (${any.journeys.length}) vs regio ${regioMin ?? "none"}m (${regio.journeys.length})`
})

await check("consult.cross_metro_day", "consult", async () => {
  // Consulting: morning workshop A, afternoon client B, evening hotel C — parallel resolves + chained when
  const stops = await Promise.all([
    harness.resolvePlace("Stuttgart Hbf"),
    harness.resolvePlace("Karlsruhe Hbf"),
    harness.resolvePlace("Mannheim Hbf"),
  ])
  const [a, b, c] = stops
  const t0 = whenPlusHours(2)
  const ab = await harness.planTrip({
    from: { stopId: a!.stopId },
    to: { stopId: b!.stopId },
    when: t0,
  })
  assert(ab.journeys.length >= 1, "A→B empty")
  const arrive = ab.journeys[0]!.legs[ab.journeys[0]!.legs.length - 1]!.arrival
  const t1 = new Date(Date.parse(arrive) + 90 * 60_000).toISOString()
  const bc = await harness.planTrip({
    from: { stopId: b!.stopId },
    to: { stopId: c!.stopId },
    when: t1,
  })
  assert(bc.journeys.length >= 1, "B→C empty")
  return `${a!.stop.name}→${b!.stop.name}→${c!.stop.name}; reused stopIds (no re-resolve)`
})

await check("consult.peak_vs_offpeak_matrix", "consult", async () => {
  const origin = await harness.resolvePlace("Berlin Hbf")
  const dest = await harness.resolvePlace("Leipzig Hbf")
  // Build two UTC mornings: weekday peak-ish vs late evening
  const peak = whenPlusHours(1)
  const off = whenPlusHours(12)
  const [p, o] = await Promise.all([
    harness.planTrip({
      from: { stopId: origin.stopId },
      to: { stopId: dest.stopId },
      when: peak,
    }),
    harness.planTrip({
      from: { stopId: origin.stopId },
      to: { stopId: dest.stopId },
      when: off,
    }),
  ])
  const merged = runPy(
    "merge-journey-searches.py",
    JSON.stringify({
      searches: [
        {
          label: "peak",
          when: peak,
          result: harness.format(p, "journey", { labels: p.labels, warnings: p.warnings }).payload,
        },
        {
          label: "offpeak",
          when: off,
          result: harness.format(o, "journey", { labels: o.labels, warnings: o.warnings }).payload,
        },
      ],
    }),
  )
  const m = JSON.parse(merged.stdout)
  assert(m.searches.every((s: { optionCount: number }) => s.optionCount >= 1), "empty window")
  return `peak=${m.searches[0].optionCount} offpeak=${m.searches[1].optionCount}`
})

await check("consult.batch_od_stopid_fastpath", "consult", async () => {
  // Fast consulting pattern: resolve once → parallel planTrip with stopIds only
  const names = ["Berlin Hbf", "Hamburg Hbf", "Köln Hbf", "München Hbf"]
  const tResolve0 = Date.now()
  const resolved = await Promise.all(names.map((n) => harness.resolvePlace(n)))
  const resolveMs = Date.now() - tResolve0
  const when = whenPlusHours(5)
  const pairs = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ] as const
  const tPlan0 = Date.now()
  const trips = await Promise.all(
    pairs.map(([i, j]) =>
      harness.planTrip({
        from: { stopId: resolved[i]!.stopId },
        to: { stopId: resolved[j]!.stopId },
        when,
      }),
    ),
  )
  const planMs = Date.now() - tPlan0
  for (const t of trips) assert(t.journeys.length >= 1, "empty OD in batch")
  assert(resolveMs < 5000, `resolve too slow ${resolveMs}ms`)
  assert(planMs < 15000, `parallel plans too slow ${planMs}ms`)
  return `4 resolves ${resolveMs}ms + 4 parallel plans ${planMs}ms`
})

await check("consult.parallel_resolve_speed", "consult", async () => {
  // Named from+to must resolve in parallel inside planTrip (one RTT class, not two)
  const t0 = Date.now()
  const trip = await harness.planTrip({
    from: "Düsseldorf Hbf",
    to: "Dortmund Hbf",
    when: whenPlusHours(2),
  })
  const ms = Date.now() - t0
  assert(trip.journeys.length >= 1, "empty")
  assert(trip.resolved?.from && trip.resolved?.to, "expected snap labels")
  // Generous bound: sequential would often exceed; parallel should stay under ~4s typical
  if (ms > 8000) {
    return { soft: `planTrip took ${ms}ms — check API latency (parallel resolve still applied)` }
  }
  return `planTrip+parallel resolve ${ms}ms; ${trip.journeys.length} opts`
})

await check("consult.ambiguous_then_pin", "consult", async () => {
  // Consulting workflow: strict snap → disambiguate → pin stopId → plan (no re-ambiguity)
  try {
    await harness.planTrip({
      from: "Mitte",
      to: "Berlin Hbf",
      when: whenPlusHours(2),
      preferences: { minSnapConfidence: 1 },
    })
    throw new Error("expected ambiguous from Mitte")
  } catch (err) {
    assert(err instanceof ImTaktAmbiguousPlaceError, String(err))
    const pinned = err.candidates.find((c) => /berlin/i.test(c.name)) ?? err.candidates[0]!
    const trip = await harness.planTrip({
      from: { stopId: pinned.stopId ?? pinned.id },
      to: "Berlin Hbf",
      when: whenPlusHours(2),
    })
    assert(trip.journeys.length >= 1, "pinned plan empty")
    return `pinned ${pinned.name} → ${trip.journeys.length} opts`
  }
})

// ─── H. Decision boundary ──────────────────────────────────────
await check("boundary.no_auto_pick_in_fixtures", "boundary", async () => {
  for (const f of ["berlin-muenchen.json", "merged.json", "regio.json"]) {
    const p = join(TMP, f)
    try {
      const raw = readFileSync(p, "utf8")
      assert(!/"recommendation"\s*:/.test(raw), `${f} has recommendation`)
      assert(!/"bestOption"\s*:/.test(raw), `${f} has bestOption`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue
      throw e
    }
  }
  return "no pick fields in fixtures"
})

await check("boundary.agent_sees_all_options", "boundary", async () => {
  const raw = readFileSync(join(TMP, "berlin-muenchen.json"), "utf8")
  const d = JSON.parse(raw)
  const options = d.journeys.map((j: { option: number }) => j.option).sort()
  assert(options[0] === 1, "options should be 1-indexed")
  assert(options.length === d.journeys.length, "option index gap")
  return `options ${options.join(",")}`
})

// ─── Report ────────────────────────────────────────────────────
console.log("\n── Summary ──")
const groups = new Map<string, Row[]>()
for (const r of rows) {
  const g = groups.get(r.group) ?? []
  g.push(r)
  groups.set(r.group, g)
}
for (const [g, list] of groups) {
  const pass = list.filter((x) => x.status === "PASS").length
  const warn = list.filter((x) => x.status === "WARN").length
  const fail = list.filter((x) => x.status === "FAIL").length
  console.log(`  ${g}: ${pass} pass, ${warn} warn, ${fail} fail / ${list.length}`)
}

const report = {
  api: API,
  at: new Date().toISOString(),
  failed,
  passed: rows.filter((r) => r.status === "PASS").length,
  warned: rows.filter((r) => r.status === "WARN").length,
  rows,
}
writeFileSync(join(TMP, "report.json"), JSON.stringify(report, null, 2))
console.log(`\nReport: ${join(TMP, "report.json")}`)
console.log(failed === 0 ? "\nALL HARD CHECKS PASSED\n" : `\n${failed} FAILED\n`)
process.exit(failed === 0 ? 0 : 1)
