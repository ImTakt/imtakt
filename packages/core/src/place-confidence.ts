import type { MatchType, StopMatch } from "./schemas.js"

/** Warn when snap confidence is below this (stderr / warnings). */
export const SNAP_WARN_THRESHOLD = 0.85

/** Fail resolution when below this and alternatives exist far away. */
export const SNAP_FAIL_THRESHOLD = 0.7

export function needsDisambiguation(match: StopMatch): boolean {
  return match.matchType !== "exact" || match.confidence < SNAP_WARN_THRESHOLD
}

export function pickBestMatch(matches: StopMatch[], query: string): StopMatch {
  if (matches.length === 0) throw new Error("No matches")
  const plz = query.match(/\b(\d{5})\b/)?.[1]
  if (plz) {
    const withPlz = matches.find((m) => m.name.includes(plz) || m.stationName?.includes(plz))
    if (withPlz) return withPlz
  }
  const tokens = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 2)
  let best = matches[0]!
  let bestScore = -1
  for (const m of matches) {
    const name = `${m.name} ${m.stationName ?? ""}`.toLowerCase()
    let score = m.confidence
    for (const t of tokens) {
      if (name.includes(t)) score += 0.15
    }
    if (m.matchType === "exact") score += 0.2
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}

export function isAmbiguous(
  matches: StopMatch[],
  minConfidence = SNAP_FAIL_THRESHOLD,
  query = "",
): boolean {
  if (matches.length === 0) return false
  const best = pickBestMatch(matches, query)
  if (best.matchType === "exact" && best.confidence >= SNAP_WARN_THRESHOLD) return false
  if (best.confidence >= minConfidence) return false
  if (matches.length < 2) return best.confidence < minConfidence
  return true
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** True when the best-ranked match and next-best are far apart — likely wrong snap. */
export function hasDistantAlternatives(
  matches: StopMatch[],
  thresholdKm = 50,
  query = "",
): boolean {
  if (matches.length < 2) return false
  const best = pickBestMatch(matches, query)
  const rest = matches.filter((m) => m.id !== best.id)
  if (rest.length === 0) return false
  const runnerUp = pickBestMatch(rest, query)
  return haversineKm(best.location, runnerUp.location) > thresholdKm
}

export function snapWarningMessage(requested: string, match: StopMatch): string | undefined {
  if (match.matchType === "exact" && match.confidence >= SNAP_WARN_THRESHOLD) return undefined
  const pct = Math.round(match.confidence * 100)
  return `Snap: "${requested}" → ${match.name} (${match.matchType}, ${pct}%) — verify with imtakt find or pass --from-id`
}
