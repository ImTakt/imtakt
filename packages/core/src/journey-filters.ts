import type { Journey, Leg } from "./schemas.js"

export type LineClass = "long_distance" | "regional" | "local"

const LONG_DISTANCE = /^(ICE|IC|EC|ECE|TGV|RJ|D\s)/i
const WALK = /^Fußweg$/i

/** Classify a line name into long-distance, regional rail, or local/other. */
export function classifyLine(name: string): LineClass {
  if (WALK.test(name)) return "local"
  if (LONG_DISTANCE.test(name.trim())) return "long_distance"
  if (/^(RE|RB|S\d+|U\d+|M\d+|Bus|SEV)/i.test(name.trim())) return "regional"
  return "local"
}

export function journeyUsesLongDistance(journey: Journey): boolean {
  return journey.legs.some(
    (leg) => !WALK.test(leg.line.name) && classifyLine(leg.line.name) === "long_distance",
  )
}

export type FilterJourneysOptions = {
  excludeLongDistance?: boolean
  maxTransfers?: number
}

export function filterJourneys(journeys: Journey[], opts: FilterJourneysOptions = {}): Journey[] {
  let out = journeys
  if (opts.excludeLongDistance) {
    out = out.filter((j) => !journeyUsesLongDistance(j))
  }
  if (opts.maxTransfers != null) {
    out = out.filter((j) => j.transfers <= opts.maxTransfers!)
  }
  return out
}

export type JourneyLabel = "fastest" | "earliest" | "fewestTransfers"

export type RankedJourney = {
  journeyIndex: number
  tags: JourneyLabel[]
}

function arrivalIso(journey: Journey): string {
  const legs = journey.legs
  return legs[legs.length - 1]?.arrival ?? ""
}

function departureIso(journey: Journey): string {
  return journey.legs[0]?.departure ?? ""
}

/** Attach fastest / earliest arrival / fewest transfers labels to journey indices. */
export function rankJourneys(journeys: Journey[]): RankedJourney[] {
  if (journeys.length === 0) return []

  const labels = new Map<number, JourneyLabel[]>()
  const add = (idx: number, tag: JourneyLabel) => {
    const cur = labels.get(idx) ?? []
    if (!cur.includes(tag)) cur.push(tag)
    labels.set(idx, cur)
  }

  let fastestIdx = 0
  let earliestIdx = 0
  let fewestIdx = 0
  for (let i = 1; i < journeys.length; i++) {
    if (journeys[i]!.durationMinutes < journeys[fastestIdx]!.durationMinutes) fastestIdx = i
    if (arrivalIso(journeys[i]!) < arrivalIso(journeys[earliestIdx]!)) earliestIdx = i
    if (journeys[i]!.transfers < journeys[fewestIdx]!.transfers) fewestIdx = i
  }
  add(fastestIdx, "fastest")
  add(earliestIdx, "earliest")
  add(fewestIdx, "fewestTransfers")

  return [...labels.entries()]
    .map(([journeyIndex, tags]) => ({ journeyIndex, tags }))
    .sort((a, b) => a.journeyIndex - b.journeyIndex)
}

/** Flag legs with &lt; 5 min transfer time. */
export function tightTransferWarnings(journey: Journey): string[] {
  const warnings: string[] = []
  for (let i = 0; i < journey.legs.length - 1; i++) {
    const cur = journey.legs[i]!
    const next = journey.legs[i + 1]!
    if (WALK.test(cur.line.name) || WALK.test(next.line.name)) continue
    const arr = new Date(cur.arrival).getTime()
    const dep = new Date(next.departure).getTime()
    const gapMin = Math.round((dep - arr) / 60_000)
    if (gapMin >= 0 && gapMin < 5) {
      warnings.push(`Tight transfer at ${cur.destination.name}: ${gapMin} min to ${next.line.name}`)
    }
  }
  return warnings
}

export function cancelledLegWarnings(journey: Journey): string[] {
  return journey.legs
    .filter((leg) => leg.cancelled && !WALK.test(leg.line.name))
    .map((leg) => `Cancelled: ${leg.line.name} ${leg.origin.name} → ${leg.destination.name}`)
}
