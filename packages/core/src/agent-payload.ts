import type {
  FindStopsResponse,
  Journey,
  Leg,
  PlanJourneyResponse,
  StationLiveResponse,
  ViewTrainResponse,
} from "./schemas.js"
import type { RankedJourney } from "./journey-filters.js"
import {
  buildPlanIntelligence,
  optionBrief,
  type PlanIntelligence,
} from "./agent-intelligence.js"
import {
  assessJourneyRisk,
  RISK_MODEL_ID,
  type OptionRiskLevel,
  type RiskModelMeta,
} from "./connection-risk.js"
import {
  AGENT_TZ,
  changesTextDe,
  connectionHeadline,
  durationTextDe,
  localHm,
  productFamily,
} from "./bahn-format.js"
import {
  FIND_SCHEMA,
  LIVE_SCHEMA,
  PLAN_SCHEMA,
  TRAIN_SCHEMA,
  type PlanningDomain,
} from "./agent-envelope.js"

export type { OptionRiskLevel }

export type CompactLeg = {
  /** Always "ride" — walks are omitted; use transferGaps for Umstieg. */
  type: "ride"
  line: string
  /** API transit mode when present. */
  mode?: string
  /** Coarse family: ICE / RE / S / … */
  product: string
  from: string
  to: string
  fromId?: string
  toId?: string
  /** Predicted/live departure (ISO). */
  dep: string
  /** Arrival (ISO). */
  arr: string
  /** Europe/Berlin HH:MM — primary for agent display. */
  depLocal: string
  arrLocal: string
  platform?: string
  /** Only when it differs from `platform`. */
  scheduledPlatform?: string
  delayMinutes?: number
  cancelled?: boolean
  realTime?: boolean
  runId?: string
}

export type TransferGap = {
  at: string
  minutes: number
  /** "8 Min Umstieg" — DB-style label. */
  label: string
}

/** One Verbindung — DB Navigator list-card shape + ImTakt decision facets. */
export type CompactJourney = {
  option: number
  /** Primary scan line: "10:42→12:15 · 1 Std 33 Min · 1 Umstieg · RE 1, S 3" */
  headline: string
  /** headline + risk/tags — dense LLM one-liner. */
  brief: string
  tags?: string[]
  durationMinutes: number
  durationText: string
  /** Same as transfers — DB wording. */
  changes: number
  transfers: number
  changesText: string
  depart: string
  arrive: string
  departLocal: string
  arriveLocal: string
  /** Unique line names in order. */
  products: string[]
  /** @deprecated prefer `products` — kept for older agents. */
  lines: string[]
  totalDelayMinutes: number
  cancelledLegs: number
  riskLevel: OptionRiskLevel
  riskScore: number
  riskSignals: string[]
  transferGaps: TransferGap[]
  legs: CompactLeg[]
}

/** Trip header — what DB shows above the connection list. */
export type CompactTripHeader = {
  from: { name: string; stopId?: string; requested?: string }
  to: { name: string; stopId?: string; requested?: string }
  timezone: typeof AGENT_TZ
  /** "live" when RT on response; else "schedule". */
  realtime: "live" | "schedule"
  asOf?: string
}

export type CompactPlanTrip = {
  /** Wire schema — agents can pin parsers. */
  schema: typeof PLAN_SCHEMA
  /** `transit` today; `logistics` reserved for multi-stop / freight planning. */
  domain: PlanningDomain
  /** Route context (DB search header). */
  trip: CompactTripHeader
  /** Verbindungen — all options, never pre-picked. */
  journeys: CompactJourney[]
  intelligence: PlanIntelligence
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
  schema: typeof TRAIN_SCHEMA
  domain: PlanningDomain
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
  const delay = leg.delayMinutes || 0
  const out: CompactLeg = {
    type: "ride",
    line: leg.line.name,
    product: productFamily(leg.line.name),
    from: leg.origin.name,
    to: leg.destination.name,
    fromId: leg.origin.id,
    toId: leg.destination.id,
    dep: leg.departure,
    arr: leg.arrival,
    depLocal: localHm(leg.departure),
    arrLocal: localHm(leg.arrival),
  }
  if (leg.line.mode) out.mode = leg.line.mode
  if (leg.platform) out.platform = leg.platform
  if (
    leg.scheduledPlatform &&
    leg.scheduledPlatform !== leg.platform
  ) {
    out.scheduledPlatform = leg.scheduledPlatform
  }
  if (delay) out.delayMinutes = delay
  if (leg.cancelled) out.cancelled = true
  if (leg.realTime) out.realTime = true
  if (leg.runId) out.runId = leg.runId
  return out
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
    gaps.push({
      at: cur.destination.name,
      minutes,
      label: `${minutes} Min Umstieg`,
    })
  }
  return gaps
}

function journeyHasRealtime(j: Journey): boolean {
  return j.legs.some((leg) => leg.realTime === true)
}

function liveDelayMinutes(j: Journey): number {
  return j.legs
    .filter((leg) => leg.realTime === true)
    .reduce((sum, leg) => sum + Math.max(0, leg.delayMinutes ?? 0), 0)
}

function compactJourney(
  j: Journey,
  index: number,
  labels: RankedJourney[] | undefined,
  useRealtimeDelays: boolean,
  risk: ReturnType<typeof assessJourneyRisk>,
): CompactJourney {
  const legs = j.legs.map(compactLeg).filter((l): l is CompactLeg => l != null)
  const totalDelayMinutes = legs.reduce((sum, leg) => sum + (leg.delayMinutes ?? 0), 0)
  const cancelledLegs = legs.filter((leg) => leg.cancelled).length
  const transferGaps = transferGapsFromJourney(j)
  const products = [...new Set(legs.map((leg) => leg.line))]
  const tags = labels?.find((l) => l.journeyIndex === index)?.tags
  const depart = j.legs[0]?.departure ?? ""
  const arrive = j.legs[j.legs.length - 1]?.arrival ?? ""
  const headline = connectionHeadline({
    departIso: depart,
    arriveIso: arrive,
    durationMinutes: j.durationMinutes,
    transfers: j.transfers,
    products,
  })
  const briefDelay = useRealtimeDelays ? liveDelayMinutes(j) : 0
  return {
    option: index + 1,
    headline,
    brief: optionBrief({
      headline,
      riskLevel: risk.riskLevel,
      tags,
      totalDelayMinutes: briefDelay,
    }),
    tags,
    durationMinutes: j.durationMinutes,
    durationText: durationTextDe(j.durationMinutes),
    changes: j.transfers,
    transfers: j.transfers,
    changesText: changesTextDe(j.transfers),
    depart,
    arrive,
    departLocal: localHm(depart),
    arriveLocal: localHm(arrive),
    products,
    lines: products,
    totalDelayMinutes,
    cancelledLegs,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    riskSignals: risk.riskSignals,
    transferGaps,
    legs,
  }
}

function buildTripHeader(
  data: PlanJourneyResponse & {
    resolved?: {
      from?: { requested: string; stopId: string; stopName: string; confidence: number }
      to?: { requested: string; stopId: string; stopName: string; confidence: number }
    }
  },
  realtimeAvailable: boolean,
): CompactTripHeader {
  const first = data.journeys[0]
  const fromName =
    data.resolved?.from?.stopName ??
    data.meta?.from.snappedStop.name ??
    first?.legs[0]?.origin.name ??
    "?"
  const toName =
    data.resolved?.to?.stopName ??
    data.meta?.to.snappedStop.name ??
    first?.legs[first.legs.length - 1]?.destination.name ??
    "?"
  const fromId =
    data.resolved?.from?.stopId ?? data.meta?.from.snappedStop.id ?? first?.legs[0]?.origin.id
  const toId =
    data.resolved?.to?.stopId ??
    data.meta?.to.snappedStop.id ??
    first?.legs[first.legs.length - 1]?.destination.id

  const trip: CompactTripHeader = {
    from: { name: fromName, ...(fromId ? { stopId: fromId } : {}) },
    to: { name: toName, ...(toId ? { stopId: toId } : {}) },
    timezone: AGENT_TZ,
    realtime: realtimeAvailable ? "live" : "schedule",
  }
  if (data.resolved?.from?.requested) trip.from.requested = data.resolved.from.requested
  else if (data.meta && typeof data.meta.from.requested === "string") {
    trip.from.requested = data.meta.from.requested
  }
  if (data.resolved?.to?.requested) trip.to.requested = data.resolved.to.requested
  else if (data.meta && typeof data.meta.to.requested === "string") {
    trip.to.requested = data.meta.to.requested
  }
  if (data.realtime?.asOf) trip.asOf = data.realtime.asOf
  return trip
}

/** Agent-optimized journey payload — DB-Navigator card layout + decision facets. */
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
  const realtimeAvailable =
    data.realtime?.available === true || data.journeys.some(journeyHasRealtime)
  const useRealtimeDelays = realtimeAvailable
  const assessments = data.journeys.map((j) =>
    assessJourneyRisk(j, { useRealtimeDelays }),
  )
  const journeys = data.journeys.map((j, i) =>
    compactJourney(j, i, data.labels, useRealtimeDelays, assessments[i]!),
  )
  const hasLiveDelay = useRealtimeDelays && data.journeys.some((j) => liveDelayMinutes(j) > 0)
  const used = new Set<string>()
  const unavailable = new Set<string>()
  for (const a of assessments) {
    for (const x of a.riskModel.inputsUsed) used.add(x)
    for (const x of a.riskModel.inputsUnavailable) unavailable.add(x)
  }
  for (const x of used) unavailable.delete(x)
  const riskModel: RiskModelMeta = {
    id: RISK_MODEL_ID,
    kind: "deterministic_heuristic",
    version: 1,
    inputsUsed: [...used],
    inputsUnavailable: [...unavailable],
  }

  const intelJourneys = journeys.map((cj, i) => ({
    option: cj.option,
    tags: cj.tags,
    totalDelayMinutes: cj.totalDelayMinutes,
    riskLevel: cj.riskLevel,
    liveDelayMinutes: useRealtimeDelays ? liveDelayMinutes(data.journeys[i]!) : 0,
  }))

  const out: CompactPlanTrip = {
    schema: PLAN_SCHEMA,
    domain: "transit",
    trip: buildTripHeader(data, realtimeAvailable),
    journeys,
    intelligence: buildPlanIntelligence({
      journeys: intelJourneys,
      realtimeAvailable,
      riskModel,
      hasLiveDelay,
    }),
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
    schema: FIND_SCHEMA,
    domain: "transit" as const,
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
    schema: LIVE_SCHEMA,
    domain: "transit" as const,
    station: data.station.name,
    stopId: data.station.id,
    timezone: AGENT_TZ,
    realtime: data.realtime.available ? ("live" as const) : ("schedule" as const),
    asOf: data.realtime.asOf,
    departures: data.departures.slice(0, 16).map((d) => {
      const time = d.predictedTime ?? d.plannedTime
      return {
        time,
        timeLocal: localHm(time),
        line: d.line.name,
        product: productFamily(d.line.name),
        direction: d.direction,
        delayMinutes: d.delayMinutes || undefined,
        platform: d.platform,
        cancelled: d.cancelled || undefined,
        realTime: d.realTime || undefined,
        runId: d.runId,
      }
    }),
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
    schema: TRAIN_SCHEMA,
    domain: "transit" as const,
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
