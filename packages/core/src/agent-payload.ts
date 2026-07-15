import type {
  FindStopsResponse,
  Journey,
  Leg,
  PlanJourneyResponse,
  StationLiveResponse,
  ViewTrainResponse,
} from "./schemas.js"
import type { RankedJourney } from "./journey-filters.js"

export type CompactLeg = {
  line: string
  from: string
  to: string
  dep: string
  arr: string
  platform?: string
  delayMinutes?: number
  cancelled?: boolean
  realTime?: boolean
  runId?: string
}

export type TransferGap = {
  at: string
  minutes: number
}

/** Per-option decision facets — facts only; agent chooses. */
export type OptionRiskLevel = "low" | "medium" | "high"

export type CompactJourney = {
  option: number
  tags?: string[]
  durationMinutes: number
  transfers: number
  depart: string
  arrive: string
  totalDelayMinutes: number
  cancelledLegs: number
  riskLevel: OptionRiskLevel
  transferGaps: TransferGap[]
  lines: string[]
  legs: CompactLeg[]
}

export type CompactPlanTrip = {
  journeys: CompactJourney[]
  realtime?: { available: boolean; asOf: string }
  snap?: {
    from?: { requested: string; stop: string; stopId: string; confidence?: number }
    to?: { requested: string; stop: string; stopId: string; confidence?: number }
  }
  warnings?: string[]
  attribution?: string
}

export type CompactTrainStop = {
  name: string
  arrival?: string
  departure?: string
  delayMinutes: number
  platform?: string
  cancelled?: boolean
  realTime?: boolean
}

export type CompactTrain = {
  runId: string
  line: string
  direction: string
  serviceDate: string
  status: string
  currentDelayMinutes: number
  cancelled: boolean
  realTime?: boolean
  asOf: string
  currentStop?: string
  nextStop?: string
  stops: CompactTrainStop[]
}

const WALK = "Fußweg"

function compactLeg(leg: Leg): CompactLeg | null {
  if (leg.line.name === WALK) return null
  return {
    line: leg.line.name,
    from: leg.origin.name,
    to: leg.destination.name,
    dep: leg.departure,
    arr: leg.arrival,
    ...(leg.platform ? { platform: leg.platform } : {}),
    ...(leg.delayMinutes ? { delayMinutes: leg.delayMinutes } : {}),
    ...(leg.cancelled ? { cancelled: true } : {}),
    ...(leg.realTime ? { realTime: true } : {}),
    ...(leg.runId ? { runId: leg.runId } : {}),
  }
}

/** Transfer gaps between consecutive rail legs (walk legs ignored). */
export function transferGapsFromJourney(j: Journey): TransferGap[] {
  const rail = j.legs.filter((leg) => leg.line.name !== WALK)
  const gaps: TransferGap[] = []
  for (let i = 0; i < rail.length - 1; i++) {
    const cur = rail[i]!
    const next = rail[i + 1]!
    const arr = Date.parse(cur.arrival)
    const dep = Date.parse(next.departure)
    if (!Number.isFinite(arr) || !Number.isFinite(dep)) continue
    const minutes = Math.round((dep - arr) / 60_000)
    gaps.push({ at: cur.destination.name, minutes })
  }
  return gaps
}

export function riskLevelFromFacets(
  cancelledLegs: number,
  transferGaps: TransferGap[],
  totalDelayMinutes: number,
): OptionRiskLevel {
  const minGap =
    transferGaps.length > 0 ? Math.min(...transferGaps.map((g) => g.minutes)) : Number.POSITIVE_INFINITY
  if (cancelledLegs > 0 || minGap < 5) return "high"
  if (minGap <= 7 || totalDelayMinutes >= 10) return "medium"
  return "low"
}

function compactJourney(j: Journey, index: number, labels?: RankedJourney[]): CompactJourney {
  const legs = j.legs.map(compactLeg).filter((l): l is CompactLeg => l != null)
  const totalDelayMinutes = legs.reduce((sum, leg) => sum + (leg.delayMinutes ?? 0), 0)
  const cancelledLegs = legs.filter((leg) => leg.cancelled).length
  const transferGaps = transferGapsFromJourney(j)
  const lines = legs.map((leg) => leg.line)
  return {
    option: index + 1,
    tags: labels?.find((l) => l.journeyIndex === index)?.tags,
    durationMinutes: j.durationMinutes,
    transfers: j.transfers,
    depart: j.legs[0]?.departure ?? "",
    arrive: j.legs[j.legs.length - 1]?.arrival ?? "",
    totalDelayMinutes,
    cancelledLegs,
    riskLevel: riskLevelFromFacets(cancelledLegs, transferGaps, totalDelayMinutes),
    transferGaps,
    lines,
    legs,
  }
}

/** Agent-optimized journey payload — no coordinates, no walk legs, per-option facets. */
export function compactPlanTrip(
  data: PlanJourneyResponse & {
    labels?: RankedJourney[]
    warnings?: string[]
    resolved?: {
      from?: { requested: string; stopId: string; stopName: string; confidence: number }
      to?: { requested: string; stopId: string; stopName: string; confidence: number }
    }
  },
): CompactPlanTrip {
  const out: CompactPlanTrip = {
    journeys: data.journeys.map((j, i) => compactJourney(j, i, data.labels)),
  }
  if (data.realtime) {
    out.realtime = { available: data.realtime.available, asOf: data.realtime.asOf }
  }
  if (data.resolved?.from || data.resolved?.to) {
    out.snap = {}
    if (data.resolved.from) {
      out.snap.from = {
        requested: data.resolved.from.requested,
        stop: data.resolved.from.stopName,
        stopId: data.resolved.from.stopId,
        confidence: data.resolved.from.confidence,
      }
    }
    if (data.resolved.to) {
      out.snap.to = {
        requested: data.resolved.to.requested,
        stop: data.resolved.to.stopName,
        stopId: data.resolved.to.stopId,
        confidence: data.resolved.to.confidence,
      }
    }
  } else if (data.meta) {
    out.snap = {
      from: {
        requested:
          typeof data.meta.from.requested === "string"
            ? data.meta.from.requested
            : "stopId" in (data.meta.from.requested as object)
              ? (data.meta.from.requested as { stopId: string }).stopId
              : "coords",
        stop: data.meta.from.snappedStop.name,
        stopId: data.meta.from.snappedStop.id,
        confidence: data.meta.from.confidence,
      },
      to: {
        requested:
          typeof data.meta.to.requested === "string"
            ? data.meta.to.requested
            : "stopId" in (data.meta.to.requested as object)
              ? (data.meta.to.requested as { stopId: string }).stopId
              : "coords",
        stop: data.meta.to.snappedStop.name,
        stopId: data.meta.to.snappedStop.id,
        confidence: data.meta.to.confidence,
      },
    }
  }
  if (data.warnings?.length) out.warnings = data.warnings
  if (data.attribution) out.attribution = data.attribution
  return out
}

export function compactFind(data: FindStopsResponse) {
  return {
    matches: data.matches.map((m) => ({
      id: m.stopId ?? m.id,
      name: m.name,
      confidence: m.confidence,
      matchType: m.matchType,
      ...(m.matchType !== "exact" ? { note: "verify before journey" } : {}),
    })),
  }
}

export function compactLive(data: StationLiveResponse) {
  return {
    station: data.station.name,
    stopId: data.station.id,
    realtime: data.realtime.available,
    asOf: data.realtime.asOf,
    departures: data.departures.slice(0, 16).map((d) => ({
      time: d.predictedTime ?? d.plannedTime,
      line: d.line.name,
      direction: d.direction,
      delayMinutes: d.delayMinutes,
      platform: d.platform,
      cancelled: d.cancelled || undefined,
      realTime: d.realTime || undefined,
      runId: d.runId,
    })),
  }
}

function compactTrainStop(obs: ViewTrainResponse["stops"][number]): CompactTrainStop {
  return {
    name: obs.stop.name,
    ...(obs.arrival ? { arrival: obs.arrival } : {}),
    ...(obs.departure ? { departure: obs.departure } : {}),
    delayMinutes: obs.delayMinutes,
    ...(obs.platform ? { platform: obs.platform } : {}),
    ...(obs.cancelled ? { cancelled: true } : {}),
    ...(obs.realTime ? { realTime: true } : {}),
  }
}

/** Agent-optimized train run — windowed stops around current progress. */
export function compactTrain(data: ViewTrainResponse, opts?: { window?: number }): CompactTrain {
  const window = opts?.window ?? 2
  const current = data.progress.currentStopIndex
  const all = data.stops.map(compactTrainStop)
  let stops = all
  if (all.length > 20 && current != null) {
    const start = Math.max(0, current - window)
    const end = Math.min(all.length, current + window + 1)
    stops = all.slice(start, end)
  }
  return {
    runId: data.runId,
    line: data.line.name,
    direction: data.direction,
    serviceDate: data.serviceDate,
    status: data.progress.status,
    currentDelayMinutes: data.currentDelayMinutes,
    cancelled: data.cancelled,
    ...(data.realTime ? { realTime: true } : {}),
    asOf: data.asOf,
    ...(data.progress.currentStop ? { currentStop: data.progress.currentStop.name } : {}),
    ...(data.progress.nextStop ? { nextStop: data.progress.nextStop.name } : {}),
    stops,
  }
}

export function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)]
}
