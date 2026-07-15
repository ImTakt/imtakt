import {
  FindStopsRequestSchema,
  FindStopsResponseSchema,
  PlanJourneyRequestSchema,
  PlanJourneyResponseSchema,
  StationBoardResponseSchema,
  StationLiveResponseSchema,
  ViewTrainResponseSchema,
  resolveBaseUrl,
  type FindStopsRequest,
  type FindStopsResponse,
  type PlanJourneyRequest,
  type PlanJourneyResponse,
  type StationBoardResponse,
  type StationLiveResponse,
  type ViewTrainResponse,
} from "@imtakt/core"
import type { z } from "zod"
import { ImTaktApiError, ImTaktValidationError, readApiError } from "./errors.js"

export type { FindStopsRequest, FindStopsResponse, PlanJourneyRequest, PlanJourneyResponse }
export type { StationBoardResponse, StationLiveResponse, ViewTrainResponse }
export { ImTaktApiError, ImTaktValidationError } from "./errors.js"
export { ImTaktAmbiguousPlaceError, createAgentHarness, normalizeRealtime } from "./harness.js"
export type {
  AgentHarness,
  PlanTripResult,
  ResolvedPlace,
  TripPreferences,
  FormatOutput,
  HarnessFormatOptions,
} from "./harness.js"
export type {
  PlanIntelligence,
  IntelligenceLayerId,
  CompactJourney,
  CompactPlanTrip,
  CompactTripHeader,
  CompactLeg,
  PresentationMode,
  PlanningDomain,
} from "@imtakt/core"
export { PLAN_SCHEMA, FIND_SCHEMA, LIVE_SCHEMA, TRAIN_SCHEMA } from "@imtakt/core"
export { resolveBaseUrl } from "@imtakt/core"

export type ImTaktClientOptions = {
  baseUrl?: string
  /** Request timeout in ms (default 30_000). */
  timeoutMs?: number
  /** Custom fetch (for tests or proxies). Defaults to global fetch. */
  fetch?: typeof fetch
}

export type ImTaktClient = {
  findStops: (req: FindStopsRequest) => Promise<FindStopsResponse>
  planJourney: (req: PlanJourneyRequest) => Promise<PlanJourneyResponse>
  stationBoard: (stopId: string) => Promise<StationBoardResponse>
  stationLive: (
    stopId: string,
    opts?: { when?: string; limit?: number },
  ) => Promise<StationLiveResponse>
  viewTrain: (runId: string) => Promise<ViewTrainResponse>
}

const DEFAULT_TIMEOUT_MS = 30_000

function parseResponse<T>(path: string, schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new ImTaktValidationError(path, parsed.error.message)
  }
  return parsed.data
}

/** HTTP client over ImTakt Server /v1 */
export function createImTakt(options: ImTaktClientOptions = {}): ImTaktClient {
  const baseUrl = resolveBaseUrl(options.baseUrl, process.env.IMTAKT_SERVER_URL)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const httpFetch = options.fetch ?? fetch

  async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await httpFetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`ImTakt API request timed out after ${timeoutMs}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async function post<TReq, TRes>(
    path: string,
    requestSchema: z.ZodType<TReq>,
    responseSchema: z.ZodType<TRes>,
    body: TReq,
  ): Promise<TRes> {
    const payload = requestSchema.parse(body)
    const res = await fetchWithTimeout(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw await readApiError(res, path)
    return parseResponse(path, responseSchema, await res.json())
  }

  async function get<TRes>(path: string, responseSchema: z.ZodType<TRes>): Promise<TRes> {
    const res = await fetchWithTimeout(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
    })
    if (!res.ok) throw await readApiError(res, path)
    return parseResponse(path, responseSchema, await res.json())
  }

  return {
    findStops: (req) => post("/v1/stops/find", FindStopsRequestSchema, FindStopsResponseSchema, req),
    planJourney: (req) =>
      post("/v1/journeys/plan", PlanJourneyRequestSchema, PlanJourneyResponseSchema, req),
    stationBoard: (stopId) =>
      get(`/v1/stops/${encodeURIComponent(stopId)}/board`, StationBoardResponseSchema),
    stationLive: (stopId, opts) => {
      const params = new URLSearchParams()
      if (opts?.when) params.set("when", opts.when)
      if (opts?.limit != null) params.set("limit", String(opts.limit))
      const qs = params.toString()
      const path = `/v1/stations/${encodeURIComponent(stopId)}/live${qs ? `?${qs}` : ""}`
      return get(path, StationLiveResponseSchema)
    },
    viewTrain: (runId) =>
      get(`/v1/trains/${encodeURIComponent(runId)}`, ViewTrainResponseSchema),
  }
}
