import type { JourneyEndpointSnap, PlaceRef, Stop } from "@imtakt/core"
import { MAX_SNAP_RADIUS_M } from "../config"
import { getStopDocumentById, searchStopsByGeo, searchStopsByName } from "./meilisearch"
import { getPrimaryStopForStation, getStopById as getDbStop, isDbConfigured } from "./stops-db"

export type ResolvedPlace = { stop: Stop; motisStopId: string; walkMeters?: number }

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function dbStopToStop(row: NonNullable<Awaited<ReturnType<typeof getDbStop>>>): Stop {
  return {
    id: row.stationId,
    name: row.stationName,
    location: { lat: row.lat, lng: row.lng },
    modes: row.modes,
  }
}

async function routingStopForStation(stationId: string, fallbackStopId?: string) {
  if (isDbConfigured()) {
    const primary = await getPrimaryStopForStation(stationId)
    if (primary) return primary
    if (fallbackStopId) {
      const exact = await getDbStop(fallbackStopId)
      if (exact) return exact
    }
  }
  if (fallbackStopId) {
    const doc = await getStopDocumentById(fallbackStopId)
    if (doc) {
      return {
        stationId: doc.station_id,
        stationName: doc.station_name,
        lat: doc._geo.lat,
        lng: doc._geo.lng,
        motisStopId: doc.motis_stop_id,
        modes: doc.modes,
      }
    }
  }
  throw new Error(`Could not resolve station: ${stationId}`)
}

export async function resolvePlaceRef(place: PlaceRef): Promise<ResolvedPlace> {
  if (typeof place === "string") {
    const matches = await searchStopsByName(place, 1)
    if (!matches[0]) throw new Error(`Could not resolve place: ${place}`)
    const routing = await routingStopForStation(matches[0].stationId ?? matches[0].id, matches[0].stopId)
    return {
      stop: {
        id: matches[0].stationId ?? matches[0].id,
        name: matches[0].stationName ?? matches[0].name,
        location: matches[0].location,
        modes: matches[0].modes,
      },
      motisStopId: routing.motisStopId,
    }
  }

  if ("stopId" in place) {
    if (isDbConfigured()) {
      const row = await getDbStop(place.stopId)
      if (row) {
        const routing = await routingStopForStation(row.stationId, row.id)
        return { stop: dbStopToStop(row), motisStopId: routing.motisStopId }
      }
    }
    const doc = await getStopDocumentById(place.stopId)
    if (!doc) throw new Error(`Stop not found: ${place.stopId}`)
    const routing = await routingStopForStation(doc.station_id, doc.id)
    return {
      stop: {
        id: doc.station_id,
        name: doc.station_name,
        location: { lat: doc._geo.lat, lng: doc._geo.lng },
        modes: doc.modes,
      },
      motisStopId: routing.motisStopId,
    }
  }

  const matches = await searchStopsByGeo(place.lat, place.lng, 1, MAX_SNAP_RADIUS_M)
  if (!matches[0]) throw new Error(`No stop within ${MAX_SNAP_RADIUS_M}m of coordinates`)
  const routing = await routingStopForStation(matches[0].stationId ?? matches[0].id, matches[0].stopId)
  const walkMeters = Math.round(haversineM(place, matches[0].location))
  return {
    stop: {
      id: matches[0].stationId ?? matches[0].id,
      name: matches[0].stationName ?? matches[0].name,
      location: matches[0].location,
      modes: matches[0].modes,
    },
    motisStopId: routing.motisStopId,
    walkMeters,
  }
}

export function toEndpointSnap(place: PlaceRef, resolved: ResolvedPlace): JourneyEndpointSnap {
  return {
    requested: place,
    snappedStop: resolved.stop,
    walkMeters: resolved.walkMeters,
  }
}

export async function resolveEndpoint(place: PlaceRef): Promise<JourneyEndpointSnap> {
  return toEndpointSnap(place, await resolvePlaceRef(place))
}
