import type { RiskModelMeta } from "./connection-risk.js"
import type { OptionRiskLevel } from "./connection-risk.js"
import { RISK_MODEL_ID } from "./connection-risk.js"

type JourneyForIntel = {
  option: number
  tags?: string[]
  totalDelayMinutes: number
  riskLevel: OptionRiskLevel
  /** Live delay sum only when RT was used; else 0 for comparison honesty. */
  liveDelayMinutes?: number
}

/**
 * Layers that can appear on a plan response.
 * Only attach entries that are actually present — do not advertise future /intel here.
 */
export type IntelligenceLayerId = "schedule_facts" | "realtime_facts"

export type IntelligenceLayerStatus = {
  id: IntelligenceLayerId
  present: true
  source: "deterministic" | "api_realtime"
  note: string
}

/** Cross-option index — pointers only, not a recommendation. Omit fields we cannot support. */
export type OptionComparison = {
  fastest?: number
  earliest?: number
  fewestTransfers?: number
  /** Only when live RT delays exist on the plan. */
  lowestLiveDelay?: number
  lowRisk: number[]
  highRisk: number[]
}

/**
 * Machine-readable contract for agents — facts on THIS response only.
 * No empty enrichment theater, no future-layer placeholders.
 */
export type PlanIntelligence = {
  version: 1
  decisionBoundary: "agent"
  /** What is actually attached right now. */
  layers: IntelligenceLayerStatus[]
  /** How riskLevel / riskScore were computed (deterministic; not ML). */
  riskModel: RiskModelMeta
  comparison: OptionComparison
}

/** Stable field list for docs/tooling — not embedded in every plan (token cost). */
export const AGENT_WEIGH_FIELDS = [
  "headline",
  "brief",
  "tags",
  "durationMinutes",
  "changes",
  "departLocal",
  "arriveLocal",
  "products",
  "totalDelayMinutes",
  "cancelledLegs",
  "riskLevel",
  "riskScore",
  "riskSignals",
  "transferGaps",
  "legs",
] as const

/**
 * Where classical ML / archive stats belong later (/intel).
 * Exported for docs and tooling — not embedded in every plan payload
 * (avoids looking like those capabilities ship today).
 */
export const ML_POLICY = {
  useFor: [
    "run_or_line_delay_distributions",
    "hub_connection_miss_rates",
    "corridor_reliability_trends",
    "p_delay_at_stop",
    "p_miss_transfer_given_gap",
    "relative_arrival_between_runs",
  ],
  doNotUseFor: [
    "pick_best_journey_for_user",
    "learned_ranker_replacing_agent",
    "black_box_recommendation_without_explainable_factors",
    "preference_inference_from_single_request",
  ],
} as const

export function optionBrief(j: {
  headline: string
  riskLevel: OptionRiskLevel
  tags?: string[]
  totalDelayMinutes: number
}): string {
  const tag = j.tags?.length ? ` · ${j.tags.join(",")}` : ""
  const delay = j.totalDelayMinutes > 0 ? ` · +${j.totalDelayMinutes}m` : ""
  return `${j.headline} · risk ${j.riskLevel}${delay}${tag}`
}

function optionWithTag(journeys: JourneyForIntel[], tag: string): number | undefined {
  return journeys.find((j) => j.tags?.includes(tag))?.option
}

function buildComparison(
  journeys: JourneyForIntel[],
  hasLiveDelay: boolean,
): OptionComparison {
  const cmp: OptionComparison = {
    fastest: optionWithTag(journeys, "fastest"),
    earliest: optionWithTag(journeys, "earliest"),
    fewestTransfers: optionWithTag(journeys, "fewestTransfers"),
    lowRisk: journeys.filter((j) => j.riskLevel === "low").map((j) => j.option),
    highRisk: journeys.filter((j) => j.riskLevel === "high").map((j) => j.option),
  }

  if (hasLiveDelay) {
    let best: number | undefined
    let bestVal = Number.POSITIVE_INFINITY
    for (const j of journeys) {
      const d = j.liveDelayMinutes ?? j.totalDelayMinutes
      if (d < bestVal) {
        bestVal = d
        best = j.option
      }
    }
    if (best != null) cmp.lowestLiveDelay = best
  }

  return cmp
}

export function buildPlanIntelligence(args: {
  journeys: JourneyForIntel[]
  realtimeAvailable: boolean
  riskModel: RiskModelMeta
  hasLiveDelay: boolean
}): PlanIntelligence {
  const layers: IntelligenceLayerStatus[] = []
  if (args.journeys.length > 0) {
    layers.push({
      id: "schedule_facts",
      present: true,
      source: "deterministic",
      note: "Duration, transfers, lines, transfer gaps, tags from this plan",
    })
  }
  if (args.realtimeAvailable) {
    layers.push({
      id: "realtime_facts",
      present: true,
      source: "api_realtime",
      note: "Leg delays / cancellations from GTFS-RT on this response",
    })
  }

  return {
    version: 1,
    decisionBoundary: "agent",
    layers,
    riskModel: args.riskModel,
    comparison: buildComparison(args.journeys, args.hasLiveDelay),
  }
}

/** Re-export id for agents that want to pin the algorithm. */
export { RISK_MODEL_ID }
