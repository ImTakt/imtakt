import type { PlaceRef } from "./schemas.js"

/** Human-readable label for a PlaceRef (never raw JSON stopId blobs). */
export function formatPlaceRef(ref: PlaceRef, snappedName?: string): string {
  if (typeof ref === "string") return ref
  if ("stopId" in ref) return snappedName ?? ref.stopId
  return `${ref.lat.toFixed(4)}, ${ref.lng.toFixed(4)}`
}
