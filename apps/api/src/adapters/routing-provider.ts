import type { Journey, Leg, Stop, TransitMode, TravelTime } from "@imtakt/core"

export type ResolvedEndpoint = {
  stop: Stop
  motisStopId: string
  walkMeters?: number
}

export type PlanOptions = {
  when?: string
  maxResults?: number
}

export interface RoutingProvider {
  planJourney(
    from: ResolvedEndpoint,
    to: ResolvedEndpoint,
    options?: PlanOptions,
  ): Promise<Journey[]>
  travelTime(from: ResolvedEndpoint, to: ResolvedEndpoint, when?: string): Promise<TravelTime>
  stationBoard(stop: ResolvedEndpoint, when?: string): Promise<{
    stop: Stop
    departures: Array<{
      line: Leg["line"]
      direction: string
      plannedTime: string
      predictedTime?: string
      platform?: string
      delayMinutes: number
      cancelled: boolean
    }>
  }>
}

export function motisModeToTransit(mode: string): TransitMode {
  const m = mode.toUpperCase()
  if (m.includes("TRAM")) return "tram"
  if (m.includes("SUBWAY") || m.includes("METRO")) return "metro"
  if (m.includes("RAIL") || m.includes("HIGH_SPEED") || m.includes("LONG_DISTANCE") || m === "SUBURBAN")
    return "rail"
  if (m.includes("BUS")) return "bus"
  if (m.includes("FERRY")) return "ferry"
  return "other"
}
