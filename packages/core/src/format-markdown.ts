import type {
  FindStopsResponse,
  PlanJourneyResponse,
  StationBoardResponse,
  StationLiveResponse,
  ViewTrainResponse,
} from "./schemas.js"
import type { RankedJourney } from "./journey-filters.js"
import { formatPlaceRef } from "./place-ref-format.js"

const DEFAULT_TZ = "Europe/Berlin"

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
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
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

export function formatJourney(data: PlanJourneyResponse, opts?: FormatOptions): string {
  const tz = opts?.timezone ?? DEFAULT_TZ
  const compact = opts?.verbosity !== "full"
  const showRunIds = opts?.includeRunIds === true
  const lines: string[] = []

  // Warnings belong on stderr in compact mode — not duplicated in markdown body
  if (!compact && opts?.warnings?.length) {
    lines.push(formatSnapWarning(opts.warnings).trimEnd(), "")
  }

  if (data.meta) {
    const fromReq = formatPlaceRef(data.meta.from.requested, data.meta.from.snappedStop.name)
    const toReq = formatPlaceRef(data.meta.to.requested, data.meta.to.snappedStop.name)
    if (fromReq !== data.meta.from.snappedStop.name) {
      lines.push(`**From:** ${fromReq} → ${data.meta.from.snappedStop.name}`)
    }
    if (toReq !== data.meta.to.snappedStop.name) {
      lines.push(`**To:** ${toReq} → ${data.meta.to.snappedStop.name}`)
    }
    if (lines.length > 0) lines.push("")
  }

  const journeyResponse = data as PlanJourneyResponse
  if (journeyResponse.realtime) {
    const rt = journeyResponse.realtime.available ? "live GTFS-RT" : "schedule only"
    const asOf = localTime(journeyResponse.realtime.asOf, tz)
    lines.push(`_${rt} · ${asOf}_`, "")
  }

  data.journeys.forEach((journey, idx) => {
    const arrive = localTime(journey.legs[journey.legs.length - 1]?.arrival ?? "", tz)
    const depart = localTime(journey.legs[0]?.departure ?? "", tz)
    if (compact) {
      lines.push(
        `## ${idx + 1} · ${journey.durationMinutes} min · arr ${arrive}${labelTags(idx, opts?.labels)}`,
      )
    } else {
      lines.push(
        `## Option ${idx + 1} · ${journey.durationMinutes} min · ${journey.transfers} transfers${labelTags(idx, opts?.labels)}`,
      )
    }
    for (const leg of journey.legs) {
      const dep = localTime(leg.departure, tz)
      const arr = localTime(leg.arrival, tz)
      const delay = delaySuffix(leg.delayMinutes)
      const cancel = leg.cancelled ? " **X**" : ""
      const rt = !compact && !leg.realTime ? " _[sched]_" : ""
      const plat = leg.platform ? ` Gl.${leg.platform}` : ""
      if (leg.line.name === "Fußweg") {
        if (!compact) lines.push(`- ${dep}–${arr} Walk`)
        continue
      }
      const dest = compact ? shortStop(leg.destination.name) : leg.destination.name
      const run = showRunIds && leg.runId ? ` · \`${leg.runId.slice(0, 24)}…\`` : ""
      if (compact) {
        lines.push(`- **${dep}** ${leg.line.name} → ${dest}${plat}${delay}${cancel}`)
      } else {
        lines.push(
          `- **${dep}–${arr}** ${leg.line.name}${plat} ${leg.origin.name} → ${leg.destination.name}${delay}${cancel}${rt}${run}`,
        )
      }
    }
    if (compact) lines.push(`_dep ${depart} · ${journey.transfers} transfers_`, "")
    else lines.push("")
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
