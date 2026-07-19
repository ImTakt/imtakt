import type { Journey, Leg } from "./schemas.js"

export type OptionRiskLevel = "low" | "medium" | "high"

const WALK = /fu[ss]weg|walk/i

/**
 * Deterministic connection-risk heuristic (v1).
 *
 * Grounded in German passenger-rail practice:
 * - Default Mindestübergangszeit ≈ 5 min when station-specific MIT is unknown
 *   (DB-style baseline; large hubs often need more — we do not invent hub MIT).
 * - Same-platform transfers need less buffer; known platform changes need more.
 * - Effective slack = scheduled gap − inbound live delay + outbound live delay
 *   (connection buffer under delay propagation).
 * - Live delays only count when `leg.realTime === true`.
 *
 * This is NOT P(miss) and NOT historical reliability — those need /intel.
 */
export const RISK_MODEL_ID = "imtakt.connection_slack.v1"

export const DEFAULT_MIN_INTERCHANGE_MIN = 5
export const PLATFORM_CHANGE_PENALTY_MIN = 2
export const SAME_PLATFORM_CREDIT_MIN = 2

export type RiskModelMeta = {
  id: typeof RISK_MODEL_ID
  kind: "deterministic_heuristic"
  version: 1
  inputsUsed: string[]
  inputsUnavailable: string[]
}

export type ConnectionAssessment = {
  at: string
  fromLine: string
  toLine: string
  scheduledGapMin: number
  inboundDelayMin: number
  outboundDelayMin: number
  effectiveGapMin: number
  requiredMin: number
  slackMin: number
  platformChange: boolean | null
}

export type JourneyRiskAssessment = {
  riskLevel: OptionRiskLevel
  /** 0 = calm; higher = worse. medium ≥ 20, high ≥ 50 (or hard fails). */
  riskScore: number
  riskSignals: string[]
  connections: ConnectionAssessment[]
  riskModel: RiskModelMeta
}

function isWalk(leg: Leg): boolean {
  return WALK.test(leg.line.name)
}

function delayUsed(leg: Leg, useRealtimeDelays: boolean): number {
  if (!useRealtimeDelays || leg.realTime !== true) return 0
  return Math.max(0, leg.delayMinutes ?? 0)
}

function platformChange(inLeg: Leg, outLeg: Leg): boolean | null {
  const a = inLeg.platform?.trim()
  const b = outLeg.platform?.trim()
  if (!a || !b) return null
  return a !== b
}

function requiredInterchangeMin(platformChangeFlag: boolean | null): number {
  let req = DEFAULT_MIN_INTERCHANGE_MIN
  if (platformChangeFlag === true) req += PLATFORM_CHANGE_PENALTY_MIN
  if (platformChangeFlag === false) req = Math.max(2, req - SAME_PLATFORM_CREDIT_MIN)
  return req
}

function railConnections(journey: Journey): { inLeg: Leg; outLeg: Leg }[] {
  const rail = journey.legs.filter((leg) => !isWalk(leg))
  const out: { inLeg: Leg; outLeg: Leg }[] = []
  for (let i = 0; i < rail.length - 1; i++) {
    out.push({ inLeg: rail[i]!, outLeg: rail[i + 1]! })
  }
  return out
}

function levelFromScore(score: number, hardHigh: boolean): OptionRiskLevel {
  if (hardHigh || score >= 50) return "high"
  if (score >= 20) return "medium"
  return "low"
}

/**
 * Assess itinerary connection / disruption risk from observable plan facts only.
 */
export function assessJourneyRisk(
  journey: Journey,
  opts?: { useRealtimeDelays?: boolean },
): JourneyRiskAssessment {
  const useRealtimeDelays = opts?.useRealtimeDelays === true
  const inputsUsed = ["scheduled_transfer_gaps", "cancellations", "transfer_count"]
  const inputsUnavailable = [
    "station_specific_min_interchange",
    "historical_hub_miss_rate",
    "p_delay_forecast",
    "p_miss_transfer",
  ]

  if (useRealtimeDelays) {
    inputsUsed.push("realtime_leg_delays")
  } else {
    inputsUnavailable.push("realtime_leg_delays")
  }

  let score = 0
  let hardHigh = false
  const signals: string[] = []
  const connections: ConnectionAssessment[] = []
  let sawPlatform = false

  const cancelled = journey.legs.filter((leg) => !isWalk(leg) && leg.cancelled)
  if (cancelled.length > 0) {
    hardHigh = true
    score += 100
    signals.push(
      `${cancelled.length} cancelled leg(s): ${cancelled.map((l) => l.line.name).join(", ")}`,
    )
  }

  for (const { inLeg, outLeg } of railConnections(journey)) {
    const arr = Date.parse(inLeg.arrival)
    const dep = Date.parse(outLeg.departure)
    if (!Number.isFinite(arr) || !Number.isFinite(dep)) continue

    const scheduledGapMin = Math.round((dep - arr) / 60_000)
    const inboundDelayMin = delayUsed(inLeg, useRealtimeDelays)
    const outboundDelayMin = delayUsed(outLeg, useRealtimeDelays)
    const effectiveGapMin = scheduledGapMin - inboundDelayMin + outboundDelayMin
    const pc = platformChange(inLeg, outLeg)
    if (pc !== null) sawPlatform = true
    const requiredMin = requiredInterchangeMin(pc)
    const slackMin = effectiveGapMin - requiredMin

    connections.push({
      at: inLeg.destination.name,
      fromLine: inLeg.line.name,
      toLine: outLeg.line.name,
      scheduledGapMin,
      inboundDelayMin,
      outboundDelayMin,
      effectiveGapMin,
      requiredMin,
      slackMin,
      platformChange: pc,
    })

    if (effectiveGapMin < 0) {
      hardHigh = true
      score += 80
      signals.push(
        `broken connection at ${inLeg.destination.name}: effective gap ${effectiveGapMin} min ` +
          `(sched ${scheduledGapMin}, inbound +${inboundDelayMin}, outbound +${outboundDelayMin})`,
      )
    } else if (slackMin < 0) {
      score += 50
      signals.push(
        `below ~${requiredMin} min interchange at ${inLeg.destination.name}: ` +
          `slack ${slackMin} min (effective gap ${effectiveGapMin} min)`,
      )
    } else if (slackMin < 2) {
      score += 35
      signals.push(
        `fragile transfer at ${inLeg.destination.name}: ${slackMin} min slack ` +
          `after ${requiredMin} min minimum (effective gap ${effectiveGapMin} min)`,
      )
    } else if (slackMin < 5) {
      score += 20
      signals.push(
        `thin transfer at ${inLeg.destination.name}: ${slackMin} min slack ` +
          `(effective gap ${effectiveGapMin} min, need ~${requiredMin})`,
      )
    } else if (slackMin < 8 && signals.length === 0) {
      score += 8
      signals.push(
        `adequate but not generous transfer at ${inLeg.destination.name}: ${slackMin} min slack`,
      )
    }

    if (pc === true) {
      signals.push(
        `platform change at ${inLeg.destination.name}: ${inLeg.platform} → ${outLeg.platform}`,
      )
    }

    if (inboundDelayMin >= 5 && slackMin < 8) {
      score += Math.min(15, inboundDelayMin)
      signals.push(
        `inbound +${inboundDelayMin} min on ${inLeg.line.name} compresses transfer at ${inLeg.destination.name}`,
      )
    }
  }

  if (sawPlatform) inputsUsed.push("observed_platforms")
  else inputsUnavailable.push("observed_platforms")

  if (journey.transfers >= 2) {
    score += (journey.transfers - 1) * 5
    if (journey.transfers >= 3) {
      signals.push(`${journey.transfers} transfers — more connection exposure`)
    }
  }

  if (useRealtimeDelays) {
    const totalRtDelay = journey.legs
      .filter((leg) => !isWalk(leg) && leg.realTime === true)
      .reduce((s, leg) => s + Math.max(0, leg.delayMinutes ?? 0), 0)
    if (totalRtDelay >= 15) {
      score += 10
      signals.push(`${totalRtDelay} min live delay across legs`)
    } else if (totalRtDelay >= 10 && score < 20) {
      score += 5
      signals.push(`${totalRtDelay} min live delay across legs`)
    }
  }

  const seen = new Set<string>()
  const riskSignals = signals.filter((s) => {
    if (seen.has(s)) return false
    seen.add(s)
    return true
  })

  const riskLevel = levelFromScore(score, hardHigh)
  if (riskSignals.length === 0 && riskLevel === "low") {
    riskSignals.push("no structural connection stress on observable facts")
  }

  return {
    riskLevel,
    riskScore: Math.min(200, score),
    riskSignals,
    connections,
    riskModel: {
      id: RISK_MODEL_ID,
      kind: "deterministic_heuristic",
      version: 1,
      inputsUsed: [...new Set(inputsUsed)],
      inputsUnavailable: [...new Set(inputsUnavailable)],
    },
  }
}

/**
 * Single 0–100 ranking score for agents (higher = better).
 * Reconciles riskScore (worse↑) with transfer slack into one board field.
 */
export function connectionScoreFromRisk(assessment: JourneyRiskAssessment): number {
  const worstSlack = assessment.connections.reduce(
    (min, c) => Math.min(min, c.slackMin),
    Number.POSITIVE_INFINITY,
  )
  const slackPenalty =
    Number.isFinite(worstSlack) && worstSlack < 0
      ? Math.min(40, Math.abs(worstSlack) * 5)
      : Number.isFinite(worstSlack) && worstSlack < 5
        ? (5 - worstSlack) * 4
        : 0
  const raw = 100 - Math.min(100, assessment.riskScore * 0.5 + slackPenalty)
  return Math.max(0, Math.min(100, Math.round(raw)))
}
