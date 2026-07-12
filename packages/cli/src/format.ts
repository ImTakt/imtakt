import type {
  PlanJourneyResponse,
  StationLiveResponse,
  ViewTrainResponse,
} from "@imtakt/core"

const BERLIN = "Europe/Berlin"

function berlinTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BERLIN,
  })
}

function delayLabel(minutes: number): string {
  if (minutes === 0) return "+0"
  return minutes > 0 ? `+${minutes}` : String(minutes)
}

export function formatStationLive(data: StationLiveResponse): string {
  const lines: string[] = []
  const rt = data.realtime.available ? "realtime" : "scheduled"
  lines.push(`${data.station.name} · ${rt} as of ${data.realtime.asOf}`)
  lines.push("─".repeat(56))
  for (const dep of data.departures) {
    const time = berlinTime(dep.predictedTime ?? dep.plannedTime)
    const platform = dep.platform ? ` Gl ${dep.platform}` : ""
    const track = dep.runId ? `  [track: ${dep.runId}]` : ""
    lines.push(
      `${time} ${delayLabel(dep.delayMinutes).padStart(3)}  ${dep.line.name.padEnd(6)}  → ${dep.direction}${platform}${track}`,
    )
  }
  if (data.departures.length === 0) lines.push("(no departures)")
  return lines.join("\n")
}

export function formatTrainTrack(data: ViewTrainResponse): string {
  const lines: string[] = []
  const delay =
    data.currentDelayMinutes > 0 ? ` · +${data.currentDelayMinutes} min` : ""
  lines.push(
    `${data.line.name} → ${data.direction} · ${data.progress.status.replace(/_/g, " ")}${delay} · as of ${data.asOf}`,
  )
  lines.push("─".repeat(56))
  const current = data.progress.currentStopIndex
  for (let i = 0; i < data.stops.length; i++) {
    const s = data.stops[i]!
    const marker =
      i === current ? "▶" : i < (current ?? -1) ? "✓" : " "
    const time = s.departure ?? s.arrival ?? s.plannedDeparture ?? s.plannedArrival
    const when = time ? berlinTime(time) : "—"
    const plat = s.platform ? ` Gl ${s.platform}` : ""
    const d = s.delayMinutes ? ` (${delayLabel(s.delayMinutes)})` : ""
    lines.push(`  ${marker} ${s.stop.name.padEnd(28)} ${when}${plat}${d}`)
  }
  return lines.join("\n")
}

export function formatJourney(data: PlanJourneyResponse): string {
  const lines: string[] = []
  data.journeys.forEach((journey, idx) => {
    lines.push(`Option ${idx + 1} · ${journey.durationMinutes} min · ${journey.transfers} transfers`)
    for (const leg of journey.legs) {
      const dep = berlinTime(leg.departure)
      const arr = berlinTime(leg.arrival)
      const track = leg.runId ? `  → imtakt track ${leg.runId}` : ""
      lines.push(
        `  ${dep}–${arr} ${delayLabel(leg.delayMinutes)}  ${leg.line.name}  ${leg.origin.name} → ${leg.destination.name}${track}`,
      )
    }
    lines.push("")
  })
  return lines.join("\n").trimEnd()
}

export function formatHuman(data: unknown): string {
  if (!data || typeof data !== "object") return String(data)
  const d = data as Record<string, unknown>
  if (d.station && d.departures && d.realtime) {
    return formatStationLive(data as StationLiveResponse)
  }
  if (d.runId && d.stops && d.progress) {
    return formatTrainTrack(data as ViewTrainResponse)
  }
  if (d.journeys) {
    return formatJourney(data as PlanJourneyResponse)
  }
  return JSON.stringify(data, null, 2)
}
