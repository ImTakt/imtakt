import type {
  FindStopsRequest,
  FindStopsResponse,
  PlanJourneyRequest,
  PlanJourneyResponse,
  StationBoardResponse,
  ViewTrainResponse,
} from "@imtakt/core"
import { resolveBaseUrl } from "@imtakt/core"

export type ImTaktClientOptions = {
  baseUrl?: string
  /** Request timeout in ms (default 30_000). */
  timeoutMs?: number
}

export type ImTaktClient = {
  findStops: (req: FindStopsRequest) => Promise<FindStopsResponse>
  planJourney: (req: PlanJourneyRequest) => Promise<PlanJourneyResponse>
  stationBoard: (stopId: string) => Promise<StationBoardResponse>
  viewTrain: (runId: string) => Promise<ViewTrainResponse>
}

const DEFAULT_TIMEOUT_MS = 30_000

/** HTTP client over ImTakt Server /v1 */
export function createImTakt(options: ImTaktClientOptions = {}): ImTaktClient {
  const baseUrl = resolveBaseUrl(
    options.baseUrl,
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.IMTAKT_SERVER_URL,
  )
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`ImTakt API request timed out after ${timeoutMs}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithTimeout(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`ImTakt API ${path}: ${res.status}`)
    return res.json() as Promise<T>
  }

  return {
    findStops: (req) => post("/v1/stops/find", req),
    planJourney: (req) => post("/v1/journeys/plan", req),
    stationBoard: (stopId) =>
      fetchWithTimeout(`${baseUrl}/v1/stops/${encodeURIComponent(stopId)}/board`).then((r) => {
        if (!r.ok) throw new Error(`ImTakt API board: ${r.status}`)
        return r.json() as Promise<StationBoardResponse>
      }),
    viewTrain: (runId) =>
      fetchWithTimeout(`${baseUrl}/v1/trains/${encodeURIComponent(runId)}`).then((r) => {
        if (!r.ok) throw new Error(`ImTakt API train: ${r.status}`)
        return r.json() as Promise<ViewTrainResponse>
      }),
  }
}
