import {
  BOARD_SCHEMA,
  assertLiveDomain,
  compactBoard,
  compactFind,
  compactLive,
  compactPlanTrip,
  compactTrain,
  dedupeWarnings,
  filterJourneys,
  formatBoardMarkdown,
  formatCompactPlanMarkdown,
  formatMarkdown,
  formatSnapWarning,
  getDomainProfile,
  PLAN_SCHEMA,
  hasDistantAlternatives,
  isAmbiguous,
  isAmbiguousPlaceErrorBody,
  normalizeFormatKind,
  pickBestMatch,
  rankJourneys,
  cancelledLegWarnings,
  tightTransferWarnings,
  needsDisambiguation,
  parseDurationMinutes,
  resolveWhen,
  snapWarningMessage,
  SNAP_FAIL_THRESHOLD,
  SCHEDULE_ONLY_WARNING,
  type CompactBoard,
  type CompactPlanTrip,
  type CompactTrain,
  type DomainProfile,
  type FareProfile,
  type FormatKind,
  type FormatVerbosity,
  type Journey,
  type JourneyPreferences,
  type JourneyView,
  type PlaceRef,
  type PlanIntelligence,
  type PlanJourneyRequest,
  type PlanJourneyResponse,
  type PlanningDomain,
  type PresentationMode,
  type RankedJourney,
  type RealtimeSnapshot,
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
  fare?: FareProfile
  nearby?: boolean
  view?: JourneyView
  windowMinutes?: number
  arriveSlackMinutes?: number
  departSlackMinutes?: number
  minConnectionMinutes?: number
}

/**
 * Harness construction options.
 * `domain` selects the planning domain (default transit). Reserved domains throw.
 */
export type HarnessOptions = TripPreferences & {
  domain?: PlanningDomain
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

/**
 * Full plan result for agents.
 *
 * Prefer `agent` (compact envelope) for decisions and tool I/O.
 * Raw `journeys` / API fields remain for drill-down and `--verbose`.
 */
export type PlanResult = PlanJourneyResponse & {
  /** Always set — synthesized from legs when the API omits the snapshot. */
  realtime: RealtimeSnapshot
  labels: RankedJourney[]
  warnings: string[]
  preferencesApplied: TripPreferences & { serverFiltered: boolean }
  resolved?: {
    from?: PlanTripResolvedSnap
    to?: PlanTripResolvedSnap
  }
  /**
   * Decision contract — never picks a winner (`decisionBoundary: "agent"`).
   * Same object as `agent.intelligence`.
   */
  intelligence: PlanIntelligence
  /**
   * Compact agent envelope (`imtakt.agent.plan/v1`) — JSON primary for agents.
   * Same object returned by `format(result, "plan").payload`.
   */
  agent: CompactPlanTrip | CompactBoard
  /** True when agent is a thin board envelope. */
  view: JourneyView
}

/** @deprecated Use PlanResult */
export type PlanTripResult = PlanResult

export type StatusResult = StationLiveResponse & { resolved: ResolvedPlace }
export type FollowResult = ViewTrainResponse & { agent: CompactTrain }

export type PlanArgs = {
  from: PlaceRef
  to: PlaceRef
  when?: string
  arrive?: string
  leaveBy?: string
  departAfterEvent?: string
  departAfter?: string
  date?: string
  preferences?: TripPreferences
  pack?: PlanJourneyRequest["pack"]
  windows?: string
  returnAfter?: string
  dwellMinutes?: number
  stops?: string
  pageCursor?: string
}

export type FormatOutput = {
  json: string
  /** Parsed compact payload when verbosity is compact. */
  payload?: unknown
  markdown: string
  stderr?: string
  presentation: PresentationMode
}

export type HarnessFormatOptions = {
  timezone?: string
  labels?: RankedJourney[]
  warnings?: string[]
  verbosity?: FormatVerbosity
  /** Default `"json"` — agent/machine primary. */
  presentation?: PresentationMode
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

/** Minimal intelligence stub — board agents use connectionScore on rows, not this blob. */
const BOARD_INTELLIGENCE: PlanIntelligence = {
  version: 1,
  decisionBoundary: "agent",
  layers: [
    {
      id: "schedule_facts",
      present: true,
      source: "deterministic",
      note: "board connectionScore",
    },
  ],
  riskModel: {
    id: "imtakt.connection_slack.v1",
    kind: "deterministic_heuristic",
    version: 1,
    inputsUsed: ["board_connection_score"],
    inputsUnavailable: [],
  },
  comparison: { lowRisk: [], highRisk: [] },
}

function toApiPreferences(prefs: TripPreferences): JourneyPreferences | undefined {
  const out: JourneyPreferences = {}
  if (prefs.excludeLongDistance || prefs.fare === "d-ticket" || prefs.fare === "regio") {
    out.excludeLineClasses = ["long_distance"]
  }
  if (prefs.maxTransfers != null) out.maxTransfers = prefs.maxTransfers
  if (prefs.maxResults != null) out.maxResults = prefs.maxResults
  return Object.keys(out).length > 0 ? out : undefined
}

function envView(): JourneyView {
  const v = process.env.IMTAKT_VIEW?.trim().toLowerCase()
  return v === "board" ? "board" : v === "full" ? "full" : "full"
}

function envFare(): FareProfile | undefined {
  const f = process.env.IMTAKT_FARE?.trim().toLowerCase()
  if (f === "d-ticket" || f === "regio" || f === "any") return f
  return undefined
}

function envWindowMinutes(): number | undefined {
  const w = process.env.IMTAKT_WINDOW?.trim()
  if (!w) return undefined
  try {
    return parseDurationMinutes(w)
  } catch {
    return undefined
  }
}

function envArriveSlack(): number | undefined {
  const s = process.env.IMTAKT_ARRIVE_SLACK?.trim()
  if (!s) return undefined
  try {
    return parseDurationMinutes(s)
  } catch {
    return undefined
  }
}

function snapFromResolved(r: ResolvedPlace): PlanTripResolvedSnap {
  return {
    requested: placeLabel(r.requested),
    stopId: r.stopId,
    stopName: r.stop.name,
    confidence: r.confidence,
  }
}

function journeysHaveRealtime(journeys: Journey[]): boolean {
  return journeys.some((j) => j.legs.some((leg) => leg.realTime === true))
}

/**
 * Ensure every plan has an honest realtime snapshot.
 * When the API omits `realtime`, derive availability from per-leg `realTime`.
 */
export function normalizeRealtime(
  fromApi: RealtimeSnapshot | undefined,
  journeys: Journey[],
  asOfFallback: string,
): RealtimeSnapshot {
  if (fromApi) {
    return {
      available: fromApi.available === true || journeysHaveRealtime(journeys),
      asOf: fromApi.asOf,
    }
  }
  const fromLegs = journeysHaveRealtime(journeys)
  return {
    available: fromLegs,
    asOf: asOfFallback,
  }
}

function isPlanResult(data: unknown): data is PlanResult {
  if (typeof data !== "object" || data == null) return false
  if (!("agent" in data) || !("journeys" in data)) return false
  const schema = (data as PlanResult).agent?.schema
  return schema === PLAN_SCHEMA || schema === BOARD_SCHEMA
}

export type AgentHarness = {
  /** Active planning domain (transit live; logistics reserved). */
  domain: PlanningDomain
  /** Discoverable capabilities for agents / multi-domain tooling. */
  profile: DomainProfile
  /** Resolve a place (stop today; hub/depot later). */
  find: (
    ref: PlaceRef,
    opts?: { minConfidence?: number; field?: "from" | "to" },
  ) => Promise<ResolvedPlace>
  /** Time-first plan (board or full). */
  plan: (args: PlanArgs) => Promise<PlanResult | { pack: unknown }>
  /** Expand one board optionId. */
  show: (optionId: string) => Promise<PlanResult>
  /** Live observation at a place. */
  status: (
    ref: PlaceRef,
    opts?: { limit?: number; when?: string },
  ) => Promise<StatusResult>
  /** Follow a run/entity (train runId today). */
  follow: (id: string) => Promise<FollowResult>
  format: (data: unknown, kind: FormatKind, opts?: HarnessFormatOptions) => FormatOutput
  client: ImTaktClient
  /** @deprecated Use find */
  resolvePlace: (
    ref: PlaceRef,
    opts?: { minConfidence?: number; field?: "from" | "to" },
  ) => Promise<ResolvedPlace>
  /** @deprecated Use plan */
  planTrip: (args: PlanArgs) => Promise<PlanResult | { pack: unknown }>
  /** @deprecated Use show */
  showOption: (optionId: string) => Promise<PlanResult>
  /** @deprecated Use status */
  stationStatus: (
    ref: PlaceRef,
    opts?: { limit?: number; when?: string },
  ) => Promise<StatusResult>
  /** @deprecated Use follow */
  viewTrain: (id: string) => Promise<FollowResult>
}

export function createAgentHarness(
  client: ImTaktClient,
  defaults: HarnessOptions = {},
): AgentHarness {
  const domain: PlanningDomain = defaults.domain ?? "transit"
  assertLiveDomain(domain)
  const profile = getDomainProfile(domain)
  const defaultTz = defaults.timezone ?? profile.defaultTimeZone

  async function find(
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

  async function plan(args: PlanArgs): Promise<PlanResult | { pack: unknown }> {
    const prefs = {
      ...defaults,
      fare: envFare() ?? defaults.fare,
      view: defaults.view ?? envView(),
      windowMinutes: defaults.windowMinutes ?? envWindowMinutes(),
      arriveSlackMinutes: defaults.arriveSlackMinutes ?? envArriveSlack(),
      ...args.preferences,
    }
    const warnings: string[] = []
    const view: JourneyView = prefs.view ?? "full"
    const excludeLd =
      !!prefs.excludeLongDistance || prefs.fare === "d-ticket" || prefs.fare === "regio"

    if (args.pack) {
      const packReq: PlanJourneyRequest = {
        from: args.from,
        to: args.to,
        pack: args.pack,
        windows: args.windows,
        stops: args.stops,
        returnAfter: args.returnAfter
          ? resolveWhen(args.returnAfter, { date: args.date })
          : undefined,
        dwellMinutes: args.dwellMinutes,
        fare: prefs.fare,
        nearby: prefs.nearby,
        view,
        windowMinutes: prefs.windowMinutes,
        when: args.when ? resolveWhen(args.when, { date: args.date }) : undefined,
        arrive: args.arrive ? resolveWhen(args.arrive, { date: args.date }) : undefined,
        preferences: toApiPreferences(prefs),
      }
      const pack = await client.planJourneyPack(packReq)
      return { pack }
    }

    const minConfidence = prefs.minSnapConfidence ?? SNAP_FAIL_THRESHOLD
    const [fromResolved, toResolved] = await Promise.all([
      isStopIdRef(args.from)
        ? Promise.resolve(undefined)
        : find(args.from, { minConfidence, field: "from" }),
      isStopIdRef(args.to)
        ? Promise.resolve(undefined)
        : find(args.to, { minConfidence, field: "to" }),
    ])
    if (fromResolved?.warning) warnings.push(fromResolved.warning)
    if (toResolved?.warning) warnings.push(toResolved.warning)

    const date = args.date
    const when = args.when
      ? resolveWhen(args.when, { date })
      : args.arrive || args.leaveBy || args.departAfterEvent || args.departAfter
        ? undefined
        : new Date().toISOString()
    const arrive = args.arrive ? resolveWhen(args.arrive, { date }) : undefined
    const leaveBy = args.leaveBy ? resolveWhen(args.leaveBy, { date }) : undefined
    const departAfterEvent = args.departAfterEvent
      ? resolveWhen(args.departAfterEvent, { date })
      : undefined
    const departAfter = args.departAfter ? resolveWhen(args.departAfter, { date }) : undefined

    const apiPrefs = toApiPreferences({
      ...prefs,
      maxResults: prefs.maxResults ?? (view === "board" ? 10 : undefined),
      excludeLongDistance: excludeLd,
    })

    const req: PlanJourneyRequest = {
      from: resolveRefForPlan(args.from, fromResolved),
      to: resolveRefForPlan(args.to, toResolved),
      when,
      arrive,
      leaveBy,
      departAfterEvent,
      departAfter,
      windowMinutes: prefs.windowMinutes ?? (view === "board" ? 120 : undefined),
      arriveSlackMinutes: prefs.arriveSlackMinutes,
      departSlackMinutes: prefs.departSlackMinutes,
      minConnectionMinutes: prefs.minConnectionMinutes,
      nearby: prefs.nearby,
      fare: prefs.fare,
      view,
      pageCursor: args.pageCursor,
      ...(apiPrefs ? { preferences: apiPrefs } : {}),
    }

    let response: PlanJourneyResponse
    try {
      response = await client.planJourney(req)
    } catch (err) {
      if (err instanceof ImTaktApiError && err.status === 422 && isAmbiguousPlaceErrorBody(err.body)) {
        const body = err.body
        throw new ImTaktAmbiguousPlaceError(body.field, body.candidates, body.message)
      }
      throw err
    }

    let journeys = response.journeys
    const serverFiltered = response.preferencesApplied?.excludeLineClasses === true

    if (excludeLd && !serverFiltered) {
      journeys = filterJourneys(journeys, { excludeLongDistance: true })
    }
    if (prefs.maxTransfers != null) {
      journeys = filterJourneys(journeys, { maxTransfers: prefs.maxTransfers })
    }
    if (prefs.maxResults != null && journeys.length > prefs.maxResults) {
      journeys = journeys.slice(0, prefs.maxResults)
    }

    if (journeys.length === 0) {
      warnings.push(
        response.warnings?.[0] ??
          "No journeys match your preferences (try without --fare d-ticket / --regio)",
      )
    }
    if (response.warnings?.length) {
      warnings.push(...response.warnings.slice(0, 3))
    }

    // Full view only: per-leg warning fan-out is expensive and belongs on expand, not board scan
    if (view === "full") {
      for (const j of journeys) {
        warnings.push(...tightTransferWarnings(j))
        warnings.push(...cancelledLegWarnings(j))
      }
    }

    const anchor =
      arrive ?? leaveBy ?? departAfterEvent ?? departAfter ?? when ?? new Date().toISOString()
    const realtime = normalizeRealtime(response.realtime, journeys, anchor)
    if (view === "full" && !realtime.available) {
      warnings.push(SCHEDULE_ONLY_WARNING)
    }

    const labels = view === "full" ? rankJourneys(journeys) : []
    const dedupedWarnings = dedupeWarnings(warnings)

    const resolved: PlanResult["resolved"] = {}
    if (fromResolved) resolved.from = snapFromResolved(fromResolved)
    if (toResolved) resolved.to = snapFromResolved(toResolved)
    const resolvedOut = Object.keys(resolved).length > 0 ? resolved : undefined

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

    const intent =
      response.time?.intent ??
      (arrive ? "arriveBy" : leaveBy ? "leaveBy" : departAfterEvent ? "eventEnd" : "departAfter")

    let agent: CompactPlanTrip | CompactBoard
    let intelligence: PlanIntelligence

    if (view === "board") {
      agent = compactBoard({
        data: {
          ...response,
          meta,
          journeys,
          realtime,
          warnings: dedupedWarnings,
          resolved: resolvedOut,
        },
        time: {
          intent,
          anchorUtc: response.time?.anchorUtc ?? anchor,
          windowMinutes: response.time?.windowMinutes ?? prefs.windowMinutes,
          arriveSlackMinutes: prefs.arriveSlackMinutes,
          leaveByUtc: leaveBy,
        },
        fare: prefs.fare,
        excludeLongDistance: excludeLd,
        limit: prefs.maxResults ?? 20,
        cluster: response.cluster,
        alternatives: response.alternatives,
        minConnectionMinutes: prefs.minConnectionMinutes,
        domain,
      })
      // Board omits intelligence from the agent envelope; keep a tiny stub on the result type
      intelligence = BOARD_INTELLIGENCE
    } else {
      const full = compactPlanTrip(
        {
          ...response,
          meta,
          journeys,
          realtime,
          labels,
          warnings: dedupedWarnings,
          resolved: resolvedOut,
        },
        { domain },
      )
      agent = full
      intelligence = full.intelligence
    }

    return {
      ...response,
      meta,
      // Board path: drop legs from the result so accidental full dumps stay cheap.
      // Expand via show(optionId). --verbose still gets agent + meta.
      journeys: view === "board" ? [] : journeys,
      realtime,
      labels,
      warnings: dedupedWarnings,
      preferencesApplied: {
        ...prefs,
        serverFiltered,
      },
      resolved: resolvedOut,
      intelligence,
      agent,
      view,
    }
  }

  async function show(optionId: string): Promise<PlanResult> {
    const response = await client.expandJourney(optionId)
    const journeys = response.journeys
    const labels = rankJourneys(journeys)
    const realtime = normalizeRealtime(
      response.realtime,
      journeys,
      new Date().toISOString(),
    )
    const agent = compactPlanTrip(
      {
        ...response,
        journeys,
        realtime,
        labels,
        warnings: [],
      },
      { domain },
    )
    return {
      ...response,
      journeys,
      realtime,
      labels,
      warnings: [],
      preferencesApplied: { serverFiltered: false },
      intelligence: agent.intelligence,
      agent,
      view: "full",
    }
  }

  async function status(
    ref: PlaceRef,
    opts?: { limit?: number; when?: string },
  ): Promise<StatusResult> {
    const resolved = await find(ref, { field: "from" })
    const live = await client.stationLive(resolved.stopId, opts)
    return { ...live, resolved }
  }

  async function follow(id: string): Promise<FollowResult> {
    const data = await client.viewTrain(id)
    return { ...data, agent: compactTrain(data, { domain }) }
  }

  function compactJsonPayload(data: unknown, kind: FormatKind): unknown {
    switch (normalizeFormatKind(kind)) {
      case "find":
        return compactFind(data as import("@imtakt/core").FindStopsResponse, { domain })
      case "plan":
        if (isPlanResult(data)) return data.agent
        return compactPlanTrip(
          data as PlanJourneyResponse & {
            labels?: RankedJourney[]
            warnings?: string[]
            resolved?: PlanResult["resolved"]
          },
          { domain },
        )
      case "status": {
        const live = data as StationLiveResponse & { resolved?: ResolvedPlace }
        const { resolved: _r, ...liveOnly } = live
        return compactLive(liveOnly, { domain })
      }
      case "follow": {
        if (
          typeof data === "object" &&
          data != null &&
          "agent" in data &&
          (data as { agent?: CompactTrain }).agent?.schema
        ) {
          return (data as { agent: CompactTrain }).agent
        }
        return compactTrain(data as ViewTrainResponse, { domain })
      }
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
    const presentation: PresentationMode = opts?.presentation ?? "json"
    const tz = opts?.timezone ?? defaultTz
    const nk = normalizeFormatKind(kind)

    const planData = isPlanResult(data) ? data : (data as PlanResult)
    const warnings = dedupeWarnings(
      opts?.warnings ?? (nk === "plan" ? planData.warnings : undefined) ?? [],
    )
    const labels = opts?.labels ?? (nk === "plan" ? planData.labels : undefined)

    // PlanResult already carries the agent envelope — reuse it (single source).
    let compactPayload: unknown
    if (nk === "plan" && isPlanResult(data)) {
      compactPayload = data.agent
    } else if (nk === "plan") {
      compactPayload = compactPlanTrip({
        ...(data as PlanJourneyResponse),
        labels,
        warnings,
        resolved: planData.resolved,
        realtime: planData.realtime ?? (data as PlanJourneyResponse).realtime,
      })
    } else {
      compactPayload = compactJsonPayload(data, kind)
    }

    const jsonPayload = verbosity === "compact" ? compactPayload : data

    let markdown: string
    if (
      nk === "plan" &&
      compactPayload &&
      typeof compactPayload === "object" &&
      (compactPayload as CompactBoard).schema === BOARD_SCHEMA
    ) {
      markdown = formatBoardMarkdown(compactPayload as CompactBoard)
    } else if (
      nk === "plan" &&
      compactPayload &&
      typeof compactPayload === "object" &&
      (compactPayload as CompactPlanTrip).schema === PLAN_SCHEMA
    ) {
      markdown = formatCompactPlanMarkdown(compactPayload as CompactPlanTrip, {
        includeRunIds: opts?.includeRunIds === true || verbosity === "full",
      })
    } else {
      markdown = formatMarkdown(data, kind, {
        timezone: tz,
        labels,
        warnings,
        verbosity,
        includeRunIds: opts?.includeRunIds,
      })
    }

    return {
      json: JSON.stringify(jsonPayload),
      payload: verbosity === "compact" ? compactPayload : undefined,
      markdown,
      presentation,
      stderr: warnings.length > 0 ? formatSnapWarning(warnings) : undefined,
    }
  }

  return {
    domain,
    profile,
    find,
    plan,
    show,
    status,
    follow,
    format,
    client,
    resolvePlace: find,
    planTrip: plan,
    showOption: show,
    stationStatus: status,
    viewTrain: follow,
  }
}
