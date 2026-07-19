/**
 * Thin journey board envelope — breadth first, depth on expand.
 * schema: imtakt.agent.board/v1
 */
import type { Journey, PlanJourneyResponse } from "./schemas.js"
import { assessJourneyRisk, connectionScoreFromRisk, type OptionRiskLevel } from "./connection-risk.js"
import { AGENT_TZ, localHm, productFamily } from "./bahn-format.js"
import { BOARD_SCHEMA, type PlanningDomain } from "./agent-envelope.js"
import {
  buildTripTimeMeta,
  optionIdFromJourney,
  serviceDateBerlin,
  type TimeIntent,
  type TripTimeMeta,
} from "./time-parse.js"
import { classifyLine } from "./journey-filters.js"

export type BoardOption = {
  optionId: string
  departLocal: string
  arriveLocal: string
  /** ISO UTC — kept for sorting / expand; prefer *Local for display. */
  depart: string
  arrive: string
  durationMinutes: number
  changes: number
  lines: string[]
  fareOk: boolean
  riskLevel: OptionRiskLevel
  connectionScore: number
  originStop: string
  destStop: string
  /** Short flags only — no prose (prose lives on expand). */
  tags: string[]
  arriveSlackMinutes?: number
  departSlackMinutes?: number
}

export type BoardAlternatives = {
  nearbyOriginsTried?: string[]
  fasterWithSurcharge?: Array<{ summary: string; optionId?: string }>
}

export type CompactBoard = {
  schema: typeof BOARD_SCHEMA
  domain: PlanningDomain
  trip: {
    from: { name: string; stopId?: string }
    to: { name: string; stopId?: string }
    fare?: string
    time: TripTimeMeta
  }
  options: BoardOption[]
  meta: {
    windowMinutes: number
    returned: number
    truncated: boolean
    latestSafeOptionId?: string
    cluster?: { origins: string[]; destinations: string[] }
  }
  alternatives?: BoardAlternatives
  warnings?: string[]
}

function journeyLines(j: Journey): string[] {
  return [
    ...new Set(
      j.legs
        .map((l) => l.line.name)
        .filter((n) => n && !/fu[ss]weg|walk/i.test(n)),
    ),
  ]
}

function journeyDepart(j: Journey): string {
  return j.legs[0]?.departure ?? ""
}

function journeyArrive(j: Journey): string {
  return j.legs[j.legs.length - 1]?.arrival ?? ""
}

function isLongDistanceJourney(j: Journey): boolean {
  return j.legs.some((l) => classifyLine(l.line.name) === "long_distance")
}

function dedupeKey(j: Journey): string {
  return `${journeyDepart(j)}|${journeyArrive(j)}|${journeyLines(j).join(",")}`
}

export function dedupeJourneys(journeys: Journey[]): Journey[] {
  const seen = new Set<string>()
  const out: Journey[] = []
  for (const j of journeys) {
    const k = dedupeKey(j)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(j)
  }
  return out
}

export function sortJourneysForIntent(journeys: Journey[], intent: TimeIntent): Journey[] {
  const copy = [...journeys]
  if (intent === "arriveBy" || intent === "windowPack") {
    copy.sort((a, b) => {
      const arr = Date.parse(journeyArrive(a)) - Date.parse(journeyArrive(b))
      if (arr !== 0) return arr
      return a.transfers - b.transfers
    })
  } else if (intent === "leaveBy") {
    copy.sort((a, b) => Date.parse(journeyDepart(b)) - Date.parse(journeyDepart(a)))
  } else {
    copy.sort((a, b) => Date.parse(journeyDepart(a)) - Date.parse(journeyDepart(b)))
  }
  return copy
}

export type CompactBoardArgs = {
  data: PlanJourneyResponse & {
    warnings?: string[]
    resolved?: {
      from?: { stopName: string; stopId: string }
      to?: { stopName: string; stopId: string }
    }
  }
  time: {
    intent: TimeIntent
    anchorUtc: string
    windowMinutes?: number
    arriveSlackMinutes?: number
    departSlackMinutes?: number
    leaveByUtc?: string
  }
  fare?: string
  excludeLongDistance?: boolean
  limit?: number
  cluster?: { origins: string[]; destinations: string[] }
  alternatives?: BoardAlternatives
  minConnectionMinutes?: number
  /** Defaults to transit — logistics will emit logistics board schema later. */
  domain?: PlanningDomain
}

export function compactBoard(args: CompactBoardArgs): CompactBoard {
  const {
    data,
    time,
    fare,
    excludeLongDistance = false,
    limit = 20,
    cluster,
    alternatives,
    minConnectionMinutes,
    domain = "transit",
  } = args

  let journeys = dedupeJourneys(data.journeys)

  if (minConnectionMinutes != null && minConnectionMinutes > 0) {
    journeys = journeys.filter((j) => {
      const risk = assessJourneyRisk(j)
      const worst = risk.connections.reduce((m, c) => Math.min(m, c.scheduledGapMin), Infinity)
      return !Number.isFinite(worst) || worst >= minConnectionMinutes
    })
  }

  if (time.intent === "leaveBy" && time.leaveByUtc) {
    const leaveBy = Date.parse(time.leaveByUtc)
    journeys = journeys.filter((j) => Date.parse(journeyDepart(j)) <= leaveBy)
  }

  if (time.intent === "arriveBy") {
    const anchor = Date.parse(time.anchorUtc)
    const slackMs = (time.arriveSlackMinutes ?? 0) * 60_000
    journeys = journeys.filter((j) => Date.parse(journeyArrive(j)) <= anchor + slackMs)
  }

  journeys = sortJourneysForIntent(journeys, time.intent)
  const truncated = journeys.length > limit
  journeys = journeys.slice(0, limit)

  const tripTime = buildTripTimeMeta({
    intent: time.intent,
    anchorUtc: time.anchorUtc,
    windowMinutes: time.windowMinutes,
    arriveSlackMinutes: time.arriveSlackMinutes,
    departSlackMinutes: time.departSlackMinutes,
    leaveByUtc: time.leaveByUtc,
  })

  const fromName =
    data.resolved?.from?.stopName ??
    data.meta?.from.snappedStop.name ??
    journeys[0]?.legs[0]?.origin.name ??
    "?"
  const toName =
    data.resolved?.to?.stopName ??
    data.meta?.to.snappedStop.name ??
    journeys[0]?.legs[journeys[0].legs.length - 1]?.destination.name ??
    "?"

  const options: BoardOption[] = journeys.map((j) => {
    const risk = assessJourneyRisk(j, {
      useRealtimeDelays: data.realtime?.available === true,
    })
    const lines = journeyLines(j)
    const depart = journeyDepart(j)
    const arrive = journeyArrive(j)
    const fareOk = !(excludeLongDistance && isLongDistanceJourney(j))
    const tags: string[] = []
    if (fareOk && (fare === "d-ticket" || fare === "regio" || excludeLongDistance)) {
      tags.push("d_ticket")
    } else if (!fareOk) {
      tags.push("surcharge")
    }

    let arriveSlackMinutes: number | undefined
    if (time.intent === "arriveBy") {
      arriveSlackMinutes = Math.round((Date.parse(time.anchorUtc) - Date.parse(arrive)) / 60_000)
      if (arriveSlackMinutes >= 0) tags.push("arrive_before_target")
    }

    let departSlackMinutes: number | undefined
    if (time.intent === "leaveBy") {
      departSlackMinutes = Math.round((Date.parse(depart) - Date.parse(time.anchorUtc)) / 60_000)
    }

    if (serviceDateBerlin(depart) !== serviceDateBerlin(arrive)) {
      tags.push("overnight")
    }
    if (risk.connections.some((c) => c.slackMin < 2)) tags.push("tight_transfer")
    if (lines.some((l) => {
      const fam = productFamily(l)
      return fam === "ICE" || fam === "IC"
    })) {
      tags.push("long_distance")
    }

    const row: BoardOption = {
      optionId: optionIdFromJourney({ depart, arrive, lines }),
      departLocal: localHm(depart),
      arriveLocal: localHm(arrive),
      depart,
      arrive,
      durationMinutes: j.durationMinutes,
      changes: j.transfers,
      lines,
      fareOk,
      riskLevel: risk.riskLevel,
      connectionScore: connectionScoreFromRisk(risk),
      originStop: j.legs[0]?.origin.name ?? fromName,
      destStop: j.legs[j.legs.length - 1]?.destination.name ?? toName,
      tags,
    }
    if (arriveSlackMinutes != null) row.arriveSlackMinutes = arriveSlackMinutes
    if (departSlackMinutes != null) row.departSlackMinutes = departSlackMinutes
    return row
  })

  // Re-sort board rows: arriveAsc → connectionScoreDesc → changesAsc for arriveBy
  if (time.intent === "arriveBy") {
    options.sort((a, b) => {
      const arr = Date.parse(a.arrive) - Date.parse(b.arrive)
      if (arr !== 0) return arr
      if (b.connectionScore !== a.connectionScore) return b.connectionScore - a.connectionScore
      return a.changes - b.changes
    })
  }

  let latestSafeOptionId: string | undefined
  if (time.intent === "arriveBy") {
    const safe = options.filter((o) => o.fareOk && (o.arriveSlackMinutes ?? -1) >= 0)
    if (safe.length > 0) {
      const latest = safe.reduce((best, o) =>
        Date.parse(o.depart) > Date.parse(best.depart) ? o : best,
      )
      latestSafeOptionId = latest.optionId
      const idx = options.findIndex((o) => o.optionId === latest.optionId)
      if (idx >= 0) options[idx]!.tags.push("latest_safe")
    }
  } else if (time.intent === "leaveBy") {
    const ok = options.filter((o) => o.fareOk)
    if (ok.length > 0) {
      latestSafeOptionId = ok[0]!.optionId
      ok[0]!.tags.push("latest_safe")
    }
  }

  const board: CompactBoard = {
    schema: BOARD_SCHEMA,
    domain,
    trip: {
      from: {
        name: fromName,
        ...(data.resolved?.from?.stopId ? { stopId: data.resolved.from.stopId } : {}),
      },
      to: {
        name: toName,
        ...(data.resolved?.to?.stopId ? { stopId: data.resolved.to.stopId } : {}),
      },
      ...(fare ? { fare } : {}),
      time: tripTime,
    },
    options,
    meta: {
      windowMinutes: time.windowMinutes ?? 0,
      returned: options.length,
      truncated,
      latestSafeOptionId,
      ...(cluster ? { cluster } : {}),
    },
  }

  if (alternatives && (alternatives.fasterWithSurcharge?.length || alternatives.nearbyOriginsTried?.length)) {
    board.alternatives = alternatives
  }
  // Cap warnings — board is scan-first; prose detail belongs on expand
  if (data.warnings?.length) {
    board.warnings = data.warnings.slice(0, 4)
  }

  return board
}

/** Compact markdown table for board view. */
export function formatBoardMarkdown(board: CompactBoard): string {
  const lines: string[] = []
  const t = board.trip.time
  lines.push(
    `# ${board.trip.from.name} → ${board.trip.to.name}`,
    ``,
    `Time: **${t.intent}** · ${t.anchorLocal} (${t.tz ?? AGENT_TZ})` +
      (t.windowMinutes ? ` · window ${t.windowMinutes}m` : "") +
      (board.trip.fare ? ` · fare ${board.trip.fare}` : ""),
    ``,
  )

  if (board.meta.latestSafeOptionId) {
    const safe = board.options.find((o) => o.optionId === board.meta.latestSafeOptionId)
    if (safe) {
      const slack =
        safe.arriveSlackMinutes != null ? ` · ${safe.arriveSlackMinutes} min slack` : ""
      lines.push(
        `**Leave by ${safe.departLocal} · Arrive ${safe.arriveLocal}${slack}** (\`${safe.optionId}\`)`,
        ``,
      )
    }
  }

  lines.push(`| Leave | Arrive | Dur | Chg | Lines | Fare | Risk | Score | Id |`)
  lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- |`)
  for (const o of board.options) {
    lines.push(
      `| ${o.departLocal} | ${o.arriveLocal} | ${o.durationMinutes} | ${o.changes} | ${o.lines.join(", ")} | ${o.fareOk ? "ok" : "ICE"} | ${o.riskLevel} | ${o.connectionScore} | \`${o.optionId}\` |`,
    )
  }

  if (board.alternatives?.fasterWithSurcharge?.length) {
    lines.push(``, `## Faster with surcharge`)
    for (const a of board.alternatives.fasterWithSurcharge) {
      lines.push(`- ${a.summary}`)
    }
  }

  if (board.warnings?.length) {
    lines.push(``, `Warnings: ${board.warnings.join("; ")}`)
  }

  lines.push(``, `_Expand: \`imtakt show <optionId> --json\`_`)
  return lines.join("\n")
}
