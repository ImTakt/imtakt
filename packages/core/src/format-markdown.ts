import type {
  FindStopsResponse,
  PlanJourneyResponse,
  StationBoardResponse,
  StationLiveResponse,
  ViewTrainResponse,
} from "./schemas.js"
import type { RankedJourney } from "./journey-filters.js"
import { assessJourneyRisk } from "./connection-risk.js"
import {
  AGENT_TZ,
  localHm,
} from "./bahn-format.js"
import type { CompactJourney, CompactPlanTrip } from "./agent-payload.js"
import { PLAN_SCHEMA } from "./agent-envelope.js"

const DEFAULT_TZ = AGENT_TZ

export type FormatVerbosity = "compact" | "full"

export type FormatOptions = {
  timezone?: string
  labels?: RankedJourney[]
  /** Warnings render on stderr only — never inline in markdown when compact (default). */
  warnings?: string[]
  verbosity?: FormatVerbosity
  includeRunIds?: boolean
}

function localTime(iso: string, timezone: string): string {
  return localHm(iso, timezone)
}

function delaySuffix(minutes: number): string {
  if (minutes === 0) return ""
  return minutes > 0 ? ` +${minutes}` : ` ${minutes}`
}

function departuresLines(
  departures: Array<{
    line: { name: string }
    direction: string
    plannedTime: string
    predictedTime?: string
    delayMinutes: number
    platform?: string
    runId?: string
  }>,
  timezone: string,
  compact: boolean,
): string[] {
  if (departures.length === 0) return ["_No departures._"]
  const lines: string[] = []
  for (const dep of departures) {
    const time = localTime(dep.predictedTime ?? dep.plannedTime, timezone)
    const plat = dep.platform ? ` Gl.${dep.platform}` : ""
    const delay = delaySuffix(dep.delayMinutes)
    const dir = compact ? dep.direction.slice(0, 28) : dep.direction
    if (compact) {
      lines.push(`- **${time}**${delay} ${dep.line.name} → ${dir}${plat}`)
    } else {
      const runId = dep.runId ? ` · \`${dep.runId}\`` : ""
      lines.push(
        `| ${time} | ${dep.delayMinutes >= 0 ? `+${dep.delayMinutes}` : dep.delayMinutes} | ${dep.line.name} | ${dep.direction} | ${dep.platform ?? "—"} | ${dep.runId ?? "—"} |${runId}`,
      )
    }
  }
  if (!compact) {
    return [
      "| Time | Δ | Line | Direction | Gl | runId |",
      "| --- | --- | --- | --- | --- | --- |",
      ...lines,
    ]
  }
  return lines
}

export function formatSnapWarning(warnings: string[]): string {
  if (warnings.length === 0) return ""
  return warnings.map((w) => `> ⚠ ${w}`).join("\n") + "\n"
}

export function formatFind(data: FindStopsResponse, opts?: FormatOptions): string {
  const compact = opts?.verbosity !== "full"
  if (data.matches.length === 0) return "_No stops found._\n"
  const lines = compact ? [] : ["## Stops", ""]
  for (const m of data.matches) {
    const conf =
      m.matchType !== "exact" ? ` (${Math.round(m.confidence * 100)}%, ${m.matchType})` : ""
    lines.push(`- **${m.name}** \`${m.stopId ?? m.id}\`${conf}`)
  }
  return lines.join("\n") + "\n"
}

export function formatBoard(data: StationBoardResponse, opts?: FormatOptions): string {
  const tz = opts?.timezone ?? DEFAULT_TZ
  const compact = opts?.verbosity !== "full"
  const depLines = departuresLines(data.departures, tz, compact)
  return [`## ${data.stop.name}`, "", ...depLines].join("\n") + "\n"
}

export function formatStationLive(data: StationLiveResponse, opts?: FormatOptions): string {
  const tz = opts?.timezone ?? DEFAULT_TZ
  const compact = opts?.verbosity !== "full"
  const rt = data.realtime.available ? "live" : "schedule"
  const asOf = localTime(data.realtime.asOf, tz)
  const header = `_${rt}${data.realtime.available ? "" : " (no RT feed)"} · ${asOf}_`
  const depLines = departuresLines(data.departures, tz, compact)
  return [`## ${data.station.name}`, header, "", ...depLines].join("\n") + "\n"
}

export function formatTrain(data: ViewTrainResponse, opts?: FormatOptions): string {
  const tz = opts?.timezone ?? DEFAULT_TZ
  const compact = opts?.verbosity !== "full"
  const delay = data.currentDelayMinutes > 0 ? ` +${data.currentDelayMinutes} min` : ""
  const lines = [
    `## ${data.line.name} → ${data.direction}${delay}`,
    `_${data.progress.status.replace(/_/g, " ")} · ${localTime(data.asOf, tz)}_`,
    "",
  ]
  const current = data.progress.currentStopIndex
  const stops = compact
    ? data.stops.filter((_, i) => i >= (current ?? 0) - 1 && i <= (current ?? 0) + 2)
    : data.stops
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]!
    const idx = compact ? (current ?? 0) - 1 + i : i
    const marker = idx === current ? "▶" : idx < (current ?? -1) ? "✓" : "○"
    const time = s.departure ?? s.arrival ?? s.plannedDeparture ?? s.plannedArrival
    const when = time ? localTime(time, tz) : "—"
    const plat = s.platform ? ` Gl.${s.platform}` : ""
    const d = delaySuffix(s.delayMinutes)
    lines.push(`- ${marker} ${s.stop.name} ${when}${plat}${d}`)
  }
  if (!compact) lines.push("", `\`runId\`: \`${data.runId}\``)
  return lines.join("\n") + "\n"
}

function labelTags(idx: number, labels?: RankedJourney[]): string {
  const tags = labels?.find((l) => l.journeyIndex === idx)?.tags ?? []
  if (tags.length === 0) return ""
  return ` · _${tags.join(", ")}_`
}

function shortStop(name: string): string {
  const parts = name.split(",")
  return parts[parts.length - 1]?.trim() || name
}

/**
 * Markdown from compact plan — single source of truth with JSON.
 * Prefer this over formatJourney(raw) so JSON and MD never diverge.
 */
export function formatCompactPlanMarkdown(
  plan: CompactPlanTrip,
  opts?: { includeRunIds?: boolean; agentMeta?: boolean },
): string {
  const lines: string[] = []
  const { trip, journeys, intelligence } = plan

  if (opts?.agentMeta !== false) {
    lines.push(
      `_agent · ${trip.from.name} → ${trip.to.name} · ${trip.realtime} · ` +
        `domain=${plan.domain} · decisionBoundary=${intelligence.decisionBoundary} · ` +
        `fastest=#${intelligence.comparison.fastest ?? "—"} ` +
        `earliest=#${intelligence.comparison.earliest ?? "—"} ` +
        `lowRisk=[${intelligence.comparison.lowRisk.join(",") || "—"}]_`,
      "",
    )
  }

  lines.push(`# ${trip.from.name} → ${trip.to.name}`)
  const reqBits: string[] = []
  if (trip.from.requested && trip.from.requested !== trip.from.name) {
    reqBits.push(`from: ${trip.from.requested}`)
  }
  if (trip.to.requested && trip.to.requested !== trip.to.name) {
    reqBits.push(`to: ${trip.to.requested}`)
  }
  if (reqBits.length) lines.push(`_${reqBits.join(" · ")}_`)

  const asOf = trip.asOf ? localHm(trip.asOf) : ""
  lines.push(
    `_${trip.realtime}${asOf ? ` · ${asOf}` : ""} · ${trip.timezone}_`,
    "",
  )

  for (const j of journeys) {
    formatCompactJourneyCard(j, lines, opts?.includeRunIds === true)
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}

function formatCompactJourneyCard(
  j: CompactJourney,
  lines: string[],
  includeRunIds: boolean,
): void {
  const tags = j.tags?.length ? ` · _${j.tags.join(", ")}_` : ""
  lines.push(
    `## ${j.option}  ${j.departLocal} → ${j.arriveLocal}  ·  ${j.durationText}  ·  ${j.changesText}${tags}`,
  )
  lines.push(
    `${j.products.join(" · ") || "—"}  ·  risk ${j.riskLevel}` +
      (j.riskScore > 0 ? ` (${j.riskScore})` : ""),
  )

  for (let i = 0; i < j.legs.length; i++) {
    const leg = j.legs[i]!
    const delay = delaySuffix(leg.delayMinutes ?? 0)
    const cancel = leg.cancelled ? " **entfällt**" : ""
    const plat = leg.platform ? ` Gl.${leg.platform}` : ""
    const run =
      includeRunIds && leg.runId ? ` · \`${leg.runId.slice(0, 24)}…\`` : ""
    lines.push(
      `- **${leg.depLocal}–${leg.arrLocal}** ${leg.line} ${shortStop(leg.from)} → ${shortStop(leg.to)}${plat}${delay}${cancel}${run}`,
    )
    const gap = j.transferGaps[i]
    if (gap) {
      lines.push(`  - _${gap.label} in ${gap.at}_`)
    }
  }
}

export function formatJourney(data: PlanJourneyResponse, opts?: FormatOptions): string {
  // Prefer compact path when caller already compacted (schema present)
  const maybeCompact = data as unknown as CompactPlanTrip
  if (
    maybeCompact &&
    typeof maybeCompact === "object" &&
    maybeCompact.schema === PLAN_SCHEMA &&
    maybeCompact.trip &&
    Array.isArray(maybeCompact.journeys)
  ) {
    return formatCompactPlanMarkdown(maybeCompact, {
      includeRunIds: opts?.includeRunIds,
    })
  }

  // Fallback: build presentation via assess on raw API (verbose / legacy)
  const tz = opts?.timezone ?? DEFAULT_TZ
  const compact = opts?.verbosity !== "full"
  const showRunIds = opts?.includeRunIds === true
  const lines: string[] = []

  if (!compact && opts?.warnings?.length) {
    lines.push(formatSnapWarning(opts.warnings).trimEnd(), "")
  }

  const fromName =
    data.meta?.from.snappedStop.name ?? data.journeys[0]?.legs[0]?.origin.name
  const toName =
    data.meta?.to.snappedStop.name ??
    data.journeys[0]?.legs[data.journeys[0].legs.length - 1]?.destination.name
  if (fromName && toName) {
    lines.push(`# ${fromName} → ${toName}`, "")
  }

  if (data.realtime) {
    const rt = data.realtime.available ? "live" : "schedule"
    lines.push(`_${rt} · ${localTime(data.realtime.asOf, tz)} · ${tz}_`, "")
  }

  data.journeys.forEach((journey, idx) => {
    const arrive = localTime(journey.legs[journey.legs.length - 1]?.arrival ?? "", tz)
    const depart = localTime(journey.legs[0]?.departure ?? "", tz)
    const useRt =
      data.realtime?.available === true || journey.legs.some((leg) => leg.realTime === true)
    const risk = assessJourneyRisk(journey, { useRealtimeDelays: useRt })
    const products = journey.legs
      .filter((leg) => leg.line.name !== "Fußweg")
      .map((leg) => leg.line.name)
      .filter((name, i, arr) => arr.indexOf(name) === i)
    const tags = labelTags(idx, opts?.labels)
    lines.push(`## ${idx + 1}  ${depart} → ${arrive}  ·  ${journey.durationMinutes} Min  ·  ${journey.transfers} Umstiege${tags}`)
    lines.push(`${products.join(" · ") || "—"}  ·  risk ${risk.riskLevel}`)
    const rail = journey.legs.filter((leg) => leg.line.name !== "Fußweg")
    for (let i = 0; i < rail.length; i++) {
      const leg = rail[i]!
      const plat = leg.platform ? ` Gl.${leg.platform}` : ""
      const run = showRunIds && leg.runId ? ` · \`${leg.runId.slice(0, 24)}…\`` : ""
      lines.push(
        `- **${localTime(leg.departure, tz)}–${localTime(leg.arrival, tz)}** ${leg.line.name} ${shortStop(leg.origin.name)} → ${shortStop(leg.destination.name)}${plat}${delaySuffix(leg.delayMinutes)}${leg.cancelled ? " **entfällt**" : ""}${run}`,
      )
      if (i < rail.length - 1) {
        const next = rail[i + 1]!
        const gapMin = Math.round(
          (Date.parse(next.departure) - Date.parse(leg.arrival)) / 60_000,
        )
        if (Number.isFinite(gapMin)) {
          lines.push(`  - _${gapMin} Min Umstieg in ${leg.destination.name}_`)
        }
      }
    }
    lines.push("")
  })
  return lines.join("\n").trimEnd() + "\n"
}

export type FormatKind = "find" | "journey" | "live" | "board" | "train"

export function formatMarkdown(
  data: unknown,
  kind: FormatKind,
  opts?: FormatOptions,
): string {
  switch (kind) {
    case "find":
      return formatFind(data as FindStopsResponse, opts)
    case "journey":
      return formatJourney(data as PlanJourneyResponse, opts)
    case "live":
      return formatStationLive(data as StationLiveResponse, opts)
    case "board":
      return formatBoard(data as StationBoardResponse, opts)
    case "train":
      return formatTrain(data as ViewTrainResponse, opts)
    default:
      return JSON.stringify(data, null, 2)
  }
}
