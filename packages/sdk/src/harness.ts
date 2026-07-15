import {
  compactFind,
  compactLive,
  compactPlanTrip,
  compactTrain,
  dedupeWarnings,
  filterJourneys,
  formatMarkdown,
  formatSnapWarning,
  hasDistantAlternatives,
  isAmbiguous,
  isAmbiguousPlaceErrorBody,
  pickBestMatch,
  rankJourneys,
  cancelledLegWarnings,
  tightTransferWarnings,
  needsDisambiguation,
  snapWarningMessage,
  SNAP_FAIL_THRESHOLD,
  SCHEDULE_ONLY_WARNING,
  type FormatKind,
  type FormatVerbosity,
  type JourneyPreferences,
  type PlaceRef,
  type PlanJourneyResponse,
  type RankedJourney,
  type Stop,
  type StopMatch,
  type StationLiveResponse,
  type ViewTrainResponse,
} from "@imtakt/core"
import type { ImTaktClient } from "./index.js"
import { ImTaktApiError } from "./errors.js"

export type TripPreferences = {
  excludeLongDistance?: boolean
  minSnapConfidence?: number
  maxTransfers?: number
  maxResults?: number
  timezone?: string
}

export type ResolvedPlace = {
  requested: PlaceRef
  stopId: string
  stop: Stop
  confidence: number
  matchType: StopMatch["matchType"]
  alternatives: StopMatch[]
  warning?: string
}

export type PlanTripResolvedSnap = {
  requested: string
  stopId: string
  stopName: string
  confidence: number
}

export type PlanTripResult = PlanJourneyResponse & {
  labels: RankedJourney[]
  warnings: string[]
  preferencesApplied: TripPreferences & { serverFiltered: boolean }
  resolved?: {
    from?: PlanTripResolvedSnap
    to?: PlanTripResolvedSnap
  }
}

export type FormatOutput = {
  /** Compact or full JSON string for stdout / piping. */
  json?: string
  /** Parsed payload when verbosity is compact — avoids parse/stringify round-trips. */
  payload?: unknown
  markdown?: string
  stderr?: string
}

export type HarnessFormatOptions = {
  timezone?: string
  labels?: RankedJourney[]
  warnings?: string[]
  verbosity?: FormatVerbosity
  includeRunIds?: boolean
}

export class ImTaktAmbiguousPlaceError extends Error {
  readonly name = "ImTaktAmbiguousPlaceError"

  constructor(
    readonly field: "from" | "to",
    readonly candidates: StopMatch[],
    message: string,
  ) {
    super(message)
  }
}

function isStopIdRef(ref: PlaceRef): ref is { stopId: string } {
  return typeof ref === "object" && ref != null && "stopId" in ref
}

function placeLabel(ref: PlaceRef): string {
  if (typeof ref === "string") return ref
  if ("stopId" in ref) return ref.stopId
  return `${ref.lat},${ref.lng}`
}

function toApiPreferences(prefs: TripPreferences): JourneyPreferences | undefined {
  const out: JourneyPreferences = {}
  if (prefs.excludeLongDistance) out.excludeLineClasses = ["long_distance"]
  if (prefs.maxTransfers != null) out.maxTransfers = prefs.maxTransfers
  if (prefs.maxResults != null) out.maxResults = prefs.maxResults
  return Object.keys(out).length > 0 ? out : undefined
}

function snapFromResolved(r: ResolvedPlace): PlanTripResolvedSnap {
  return {
    requested: placeLabel(r.requested),
    stopId: r.stopId,
    stopName: r.stop.name,
    confidence: r.confidence,
  }
}

export type AgentHarness = {
  resolvePlace: (ref: PlaceRef, opts?: { minConfidence?: number; field?: "from" | "to" }) => Promise<ResolvedPlace>
  planTrip: (args: {
    from: PlaceRef
    to: PlaceRef
    when?: string
    preferences?: TripPreferences
  }) => Promise<PlanTripResult>
  stationStatus: (
    ref: PlaceRef,
    opts?: { limit?: number; when?: string },
  ) => Promise<StationLiveResponse & { resolved: ResolvedPlace }>
  format: (data: unknown, kind: FormatKind, opts?: HarnessFormatOptions) => FormatOutput
  client: ImTaktClient
}

export function createAgentHarness(
  client: ImTaktClient,
  defaults: TripPreferences = {},
): AgentHarness {
  const defaultTz = defaults.timezone ?? "Europe/Berlin"

  async function resolvePlace(
    ref: PlaceRef,
    opts?: { minConfidence?: number; field?: "from" | "to" },
  ): Promise<ResolvedPlace> {
    const field = opts?.field ?? "from"
    const minConfidence = opts?.minConfidence ?? defaults.minSnapConfidence ?? SNAP_FAIL_THRESHOLD

    if (isStopIdRef(ref)) {
      return {
        requested: ref,
        stopId: ref.stopId,
        stop: { id: ref.stopId, name: ref.stopId, location: { lat: 0, lng: 0 } },
        confidence: 1,
        matchType: "exact",
        alternatives: [],
      }
    }

    if (typeof ref === "object" && "lat" in ref) {
      const found = await client.findStops({ lat: ref.lat, lng: ref.lng, limit: 1 })
      const match = found.matches[0]
      if (!match) throw new Error(`No stop near coordinates ${ref.lat},${ref.lng}`)
      return {
        requested: ref,
        stopId: match.stopId ?? match.id,
        stop: { id: match.id, name: match.name, location: match.location, modes: match.modes },
        confidence: match.confidence,
        matchType: match.matchType,
        alternatives: found.matches.slice(1, 4),
        warning: snapWarningMessage(placeLabel(ref), match),
      }
    }

    const place = ref as string
    const found = await client.findStops({ place, limit: 5 })
    if (found.matches.length === 0) {
      throw new Error(`Station not found: ${place}`)
    }

    const best = pickBestMatch(found.matches, place)
    const ambiguous =
      isAmbiguous(found.matches, minConfidence, place) ||
      (best.confidence < minConfidence &&
        needsDisambiguation(best) &&
        hasDistantAlternatives(found.matches, 50, place))

    if (ambiguous && minConfidence >= SNAP_FAIL_THRESHOLD) {
      throw new ImTaktAmbiguousPlaceError(
        field,
        found.matches.slice(0, 5),
        `Ambiguous place "${place}" — pass { stopId } or use imtakt find to disambiguate`,
      )
    }

    return {
      requested: ref,
      stopId: best.stopId ?? best.id,
      stop: { id: best.id, name: best.name, location: best.location, modes: best.modes },
      confidence: best.confidence,
      matchType: best.matchType,
      alternatives: found.matches.slice(1, 4),
      warning: snapWarningMessage(place, best),
    }
  }

  function resolveRefForPlan(ref: PlaceRef, resolved?: ResolvedPlace): PlaceRef {
    if (isStopIdRef(ref)) return ref
    if (resolved) return { stopId: resolved.stopId }
    return ref
  }

  async function planTrip(args: {
    from: PlaceRef
    to: PlaceRef
    when?: string
    preferences?: TripPreferences
  }): Promise<PlanTripResult> {
    const prefs = { ...defaults, ...args.preferences }
    const warnings: string[] = []

    // Parallel resolve — consulting multi-OD work is dominated by place lookup RTT.
    const minConfidence = prefs.minSnapConfidence ?? SNAP_FAIL_THRESHOLD
    const [fromResolved, toResolved] = await Promise.all([
      isStopIdRef(args.from)
        ? Promise.resolve(undefined)
        : resolvePlace(args.from, { minConfidence, field: "from" }),
      isStopIdRef(args.to)
        ? Promise.resolve(undefined)
        : resolvePlace(args.to, { minConfidence, field: "to" }),
    ])
    if (fromResolved?.warning) warnings.push(fromResolved.warning)
    if (toResolved?.warning) warnings.push(toResolved.warning)

    const when = args.when ?? new Date().toISOString()
    const apiPrefs = toApiPreferences(prefs)

    let response: PlanJourneyResponse
    try {
      response = await client.planJourney({
        from: resolveRefForPlan(args.from, fromResolved),
        to: resolveRefForPlan(args.to, toResolved),
        when,
        ...(apiPrefs ? { preferences: apiPrefs } : {}),
      })
    } catch (err) {
      if (err instanceof ImTaktApiError && err.status === 422 && isAmbiguousPlaceErrorBody(err.body)) {
        const body = err.body
        throw new ImTaktAmbiguousPlaceError(body.field, body.candidates, body.message)
      }
      throw err
    }

    let journeys = response.journeys
    const serverFiltered = response.preferencesApplied?.excludeLineClasses === true

    if (prefs.excludeLongDistance && !serverFiltered) {
      journeys = filterJourneys(journeys, { excludeLongDistance: true })
    }
    if (prefs.maxTransfers != null) {
      journeys = filterJourneys(journeys, { maxTransfers: prefs.maxTransfers })
    }

    if (journeys.length === 0) {
      warnings.push("No journeys match your preferences (try without --regio)")
    }

    for (const j of journeys) {
      warnings.push(...tightTransferWarnings(j))
      warnings.push(...cancelledLegWarnings(j))
    }

    const hasRealtime =
      response.realtime?.available === true ||
      journeys.some((j) => j.legs.some((leg) => leg.realTime))
    if (!hasRealtime) {
      warnings.push(SCHEDULE_ONLY_WARNING)
    }

    const labels = rankJourneys(journeys)
    const dedupedWarnings = dedupeWarnings(warnings)

    const resolved: PlanTripResult["resolved"] = {}
    if (fromResolved) resolved.from = snapFromResolved(fromResolved)
    if (toResolved) resolved.to = snapFromResolved(toResolved)

    let meta = response.meta
    if (meta) {
      if (fromResolved && typeof args.from === "string") {
        meta = {
          ...meta,
          from: {
            ...meta.from,
            requested: args.from,
            snappedStop: {
              id: fromResolved.stopId,
              name: fromResolved.stop.name,
              location: fromResolved.stop.location,
            },
            confidence: fromResolved.confidence,
          },
        }
      }
      if (toResolved && typeof args.to === "string") {
        meta = {
          ...meta,
          to: {
            ...meta.to,
            requested: args.to,
            snappedStop: {
              id: toResolved.stopId,
              name: toResolved.stop.name,
              location: toResolved.stop.location,
            },
            confidence: toResolved.confidence,
          },
        }
      }
    }

    return {
      ...response,
      meta,
      journeys,
      labels,
      warnings: dedupedWarnings,
      preferencesApplied: {
        ...prefs,
        serverFiltered,
      },
      resolved: Object.keys(resolved).length > 0 ? resolved : undefined,
    }
  }

  async function stationStatus(
    ref: PlaceRef,
    opts?: { limit?: number; when?: string },
  ): Promise<StationLiveResponse & { resolved: ResolvedPlace }> {
    const resolved = await resolvePlace(ref, { field: "from" })
    const live = await client.stationLive(resolved.stopId, opts)
    return { ...live, resolved }
  }

  function compactJsonPayload(data: unknown, kind: FormatKind, opts?: HarnessFormatOptions): unknown {
    switch (kind) {
      case "find":
        return compactFind(data as import("@imtakt/core").FindStopsResponse)
      case "journey":
        return compactPlanTrip(
          data as PlanJourneyResponse & {
            labels?: RankedJourney[]
            warnings?: string[]
            resolved?: PlanTripResult["resolved"]
          },
        )
      case "live": {
        const live = data as StationLiveResponse & { resolved?: ResolvedPlace }
        const { resolved: _r, ...liveOnly } = live
        return compactLive(liveOnly)
      }
      case "train":
        return compactTrain(data as ViewTrainResponse)
      default:
        return data
    }
  }

  function format(
    data: unknown,
    kind: FormatKind,
    opts?: HarnessFormatOptions,
  ): FormatOutput {
    const verbosity = opts?.verbosity ?? "compact"
    const tz = opts?.timezone ?? defaultTz
    const journeyData = data as PlanTripResult
    const warnings = dedupeWarnings(
      opts?.warnings ?? (kind === "journey" ? journeyData.warnings : undefined) ?? [],
    )
    const labels = opts?.labels ?? (kind === "journey" ? journeyData.labels : undefined)

    const jsonPayload =
      verbosity === "compact" ? compactJsonPayload(data, kind, opts) : data

    const markdown = formatMarkdown(data, kind, {
      timezone: tz,
      labels,
      warnings,
      verbosity,
      includeRunIds: opts?.includeRunIds,
    })

    return {
      json: JSON.stringify(jsonPayload),
      payload: verbosity === "compact" ? jsonPayload : undefined,
      markdown,
      stderr: warnings.length > 0 ? formatSnapWarning(warnings) : undefined,
    }
  }

  return {
    resolvePlace,
    planTrip,
    stationStatus,
    format,
    client,
  }
}
