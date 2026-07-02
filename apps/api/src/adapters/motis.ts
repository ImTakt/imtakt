import type { Journey, Leg, Stop, TravelTime } from "@imtakt/core"
import { config, DEFAULT_BOARD_DEPARTURES, DEFAULT_JOURNEY_OPTIONS, MAX_TRANSFERS } from "../config"
import {
  motisModeToTransit,
  type PlanOptions,
  type ResolvedEndpoint,
  type RoutingProvider,
} from "./routing-provider"

type MotisPlace = {
  name?: string
  lat?: number
  lon?: number
  stopId?: string
  platform?: string
}

type MotisLeg = {
  mode: string
  from: MotisPlace
  to: MotisPlace
  startTime: string
  endTime: string
  scheduledStartTime?: string
  scheduledEndTime?: string
  duration: number
  routeShortName?: string
  displayName?: string
  headsign?: string
  cancelled?: boolean
  delay?: number
}

type MotisItinerary = {
  duration: number
  transfers: number
  legs: MotisLeg[]
}

type MotisPlanResponse = {
  itineraries: MotisItinerary[]
}

type MotisStoptimesResponse = {
  stops?: Array<{
    stopId: string
    name: string
    lat: number
    lon: number
  }>
  events?: Array<{
    startTime: string
    scheduledStartTime?: string
    mode: string
    routeShortName?: string
    displayName?: string
    headsign?: string
    cancelled?: boolean
    delay?: number
    platform?: string
  }>
}

function motisPlaceToStop(place: MotisPlace, fallbackId: string): Stop {
  return {
    id: place.stopId ? `de_${place.stopId.replace(/^de_/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 500)}` : fallbackId,
    name: place.name ?? "Unknown",
    location: {
      lat: place.lat ?? 0,
      lng: place.lon ?? 0,
    },
  }
}

function motisLegToLeg(leg: MotisLeg): Leg | null {
  const mode = motisModeToTransit(leg.mode)
  const isWalk = leg.mode.toUpperCase().includes("FOOT") || leg.mode.toUpperCase() === "WALK"
  const lineName =
    leg.displayName ?? leg.routeShortName ?? leg.headsign ?? (isWalk ? "Fußweg" : leg.mode)

  return {
    origin: motisPlaceToStop(leg.from, "origin"),
    destination: motisPlaceToStop(leg.to, "destination"),
    plannedDeparture: leg.scheduledStartTime ?? leg.startTime,
    departure: leg.startTime,
    arrival: leg.endTime,
    delayMinutes: Math.round((leg.delay ?? 0) / 60),
    line: { name: lineName, mode: isWalk ? "other" : mode },
    platform: leg.from.platform,
    cancelled: leg.cancelled ?? false,
  }
}

function formatMotisPlace(endpoint: ResolvedEndpoint): string {
  return endpoint.motisStopId
}

export class MotisRoutingProvider implements RoutingProvider {
  private async motisGet<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
    const url = new URL(path, config.motisUrl)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error("Routing backend unavailable")
    return res.json() as Promise<T>
  }

  async planJourney(
    from: ResolvedEndpoint,
    to: ResolvedEndpoint,
    options: PlanOptions = {},
  ): Promise<Journey[]> {
    const data = await this.motisGet<MotisPlanResponse>("/api/v6/plan", {
      fromPlace: formatMotisPlace(from),
      toPlace: formatMotisPlace(to),
      time: options.when,
      maxItineraries: options.maxResults ?? DEFAULT_JOURNEY_OPTIONS,
      numItineraries: options.maxResults ?? DEFAULT_JOURNEY_OPTIONS,
      maxTransfers: MAX_TRANSFERS,
      timetableView: true,
    })

    return (data.itineraries ?? []).slice(0, options.maxResults ?? DEFAULT_JOURNEY_OPTIONS).map((it) => {
      const legs = it.legs.map(motisLegToLeg).filter((l): l is Leg => l != null)
      return {
        legs,
        durationMinutes: Math.round(it.duration / 60),
        transfers: it.transfers,
      }
    })
  }

  async travelTime(from: ResolvedEndpoint, to: ResolvedEndpoint, when?: string): Promise<TravelTime> {
    const journeys = await this.planJourney(from, to, { when, maxResults: 1 })
    const best = journeys[0]
    if (!best) throw new Error("No route found")
    return {
      durationMinutes: best.durationMinutes,
      transfers: best.transfers,
    }
  }

  async stationBoard(stop: ResolvedEndpoint, when?: string) {
    const data = await this.motisGet<MotisStoptimesResponse>("/api/v6/stoptimes", {
      stopId: stop.motisStopId,
      time: when,
      direction: "LATER",
      n: DEFAULT_BOARD_DEPARTURES,
    })

    const departures = (data.events ?? []).slice(0, DEFAULT_BOARD_DEPARTURES).map((ev) => ({
      line: {
        name: ev.displayName ?? ev.routeShortName ?? ev.headsign ?? "—",
        mode: motisModeToTransit(ev.mode),
      },
      direction: ev.headsign ?? "—",
      plannedTime: ev.scheduledStartTime ?? ev.startTime,
      predictedTime: ev.startTime,
      platform: ev.platform,
      delayMinutes: Math.round((ev.delay ?? 0) / 60),
      cancelled: ev.cancelled ?? false,
    }))

    return { stop: stop.stop, departures }
  }
}

export function createRoutingProvider(): RoutingProvider {
  return new MotisRoutingProvider()
}
