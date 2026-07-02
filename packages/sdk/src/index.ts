import type {
  FindStopsRequest,
  FindStopsResponse,
  PlanJourneyRequest,
  PlanJourneyResponse,
  TravelTimeRequest,
  TravelTimeResponse,
  StationBoardResponse,
} from "@imtakt/core"
import { IMTAKT_HOSTED_API_URL } from "@imtakt/core"

export type ImTaktClientOptions = {
  baseUrl?: string
}

export type ImTaktClient = {
  findStops: (req: FindStopsRequest) => Promise<FindStopsResponse>
  planJourney: (req: PlanJourneyRequest) => Promise<PlanJourneyResponse>
  travelTime: (req: TravelTimeRequest) => Promise<TravelTimeResponse>
  stationBoard: (stopId: string) => Promise<StationBoardResponse>
}

/** HTTP client over ImTakt Server /v1 */
export function createImTakt(options: ImTaktClientOptions = {}): ImTaktClient {
  const baseUrl =
    options.baseUrl ??
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.IMTAKT_SERVER_URL ??
    IMTAKT_HOSTED_API_URL

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
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
    travelTime: (req) => post("/v1/journeys/travel-time", req),
    stationBoard: (stopId) =>
      fetch(`${baseUrl}/v1/stops/${encodeURIComponent(stopId)}/board`).then((r) => {
        if (!r.ok) throw new Error(`ImTakt API board: ${r.status}`)
        return r.json() as Promise<StationBoardResponse>
      }),
  }
}
