import type { ImTaktClient } from "@imtakt/sdk"
import type { PlaceRef } from "@imtakt/core"

/** Resolve a PlaceRef to a stable stop id for board lookups. */
export async function resolveStopId(client: ImTaktClient, station: PlaceRef): Promise<string> {
  if (typeof station === "string") {
    const found = await client.findStops({ place: station, limit: 1 })
    const match = found.matches[0]
    if (!match) throw new Error(`Station not found: ${station}`)
    return match.id
  }

  if ("stopId" in station) {
    return station.stopId
  }

  const found = await client.findStops({ lat: station.lat, lng: station.lng, limit: 1 })
  const match = found.matches[0]
  if (!match) throw new Error("No stop near coordinates")
  return match.id
}
