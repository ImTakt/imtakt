/**
 * Versioned agent envelopes — domain-agnostic presentation contract.
 *
 * Same stack across domains (transit today, logistics next):
 * - `schema` pins the wire shape for agents/tools
 * - `domain` selects semantics (passenger OD vs freight / multi-stop)
 * - Options stay undecided (`decisionBoundary: "agent"`)
 * - JSON primary for agents; markdown for humans — one channel per call
 * - Breadth-first board → expand for detail (when the domain supports it)
 */

/** Registered planning domains. Add new domains here + a DomainProfile. */
export type PlanningDomain = "transit" | "logistics"

/** Select one channel to consume — JSON is the agent/machine primary. */
export type PresentationMode = "json" | "markdown"

/** Every agent envelope starts with these two fields. */
export type AgentEnvelopeMeta = {
  schema: string
  domain: PlanningDomain
}

// ─── Transit schemas (live) ─────────────────────────────────────

/** Origin–destination passenger plan (DB-style Verbindungen). */
export const PLAN_SCHEMA = "imtakt.agent.plan/v1" as const
/** Thin OD board — many options, no legs (expand via journey show). */
export const BOARD_SCHEMA = "imtakt.agent.board/v1" as const
export const FIND_SCHEMA = "imtakt.agent.find/v1" as const
export const LIVE_SCHEMA = "imtakt.agent.live/v1" as const
export const TRAIN_SCHEMA = "imtakt.agent.train/v1" as const

// ─── Logistics schemas (reserved — not emitted yet) ─────────────

/** Multi-stop / freight plan — reserved wire id. */
export const LOGISTICS_PLAN_SCHEMA = "imtakt.agent.logistics.plan/v1" as const
/** Thin logistics option board — reserved wire id. */
export const LOGISTICS_BOARD_SCHEMA = "imtakt.agent.logistics.board/v1" as const
/** Hub / depot / gate resolve — reserved wire id. */
export const LOGISTICS_FIND_SCHEMA = "imtakt.agent.logistics.find/v1" as const

export type DomainStatus = "live" | "reserved"

/**
 * What a domain can do — harness + agents discover this instead of
 * hardcoding transit verbs.
 */
export type DomainProfile = {
  domain: PlanningDomain
  status: DomainStatus
  /** Schemas this domain may emit (live or reserved). */
  schemas: readonly string[]
  /**
   * Stable capability flags — logistics can flip these on without
   * changing the presentation stack.
   */
  capabilities: {
    /** Thin list → expand one optionId. */
    boardExpand: boolean
    /** arriveBy / leaveBy / window packs. */
    timeIntents: boolean
    /** Live / progress overlays. */
    realtime: boolean
    /** Domain-specific analytics scripts. */
    analytics: boolean
  }
  /**
   * Default display timezone for local* fields.
   * Transit: Europe/Berlin. Logistics: often UTC until lane TZ is known.
   */
  defaultTimeZone: string
  /** Human label for docs / errors. */
  label: string
  /** One-line scope. */
  summary: string
}

export const DOMAIN_PROFILES: Record<PlanningDomain, DomainProfile> = {
  transit: {
    domain: "transit",
    status: "live",
    schemas: [PLAN_SCHEMA, BOARD_SCHEMA, FIND_SCHEMA, LIVE_SCHEMA, TRAIN_SCHEMA],
    capabilities: {
      boardExpand: true,
      timeIntents: true,
      realtime: true,
      analytics: true,
    },
    defaultTimeZone: "Europe/Berlin",
    label: "Transit",
    summary: "German passenger public transport — journeys, boards, live trains",
  },
  logistics: {
    domain: "logistics",
    status: "reserved",
    schemas: [LOGISTICS_PLAN_SCHEMA, LOGISTICS_BOARD_SCHEMA, LOGISTICS_FIND_SCHEMA],
    capabilities: {
      boardExpand: true,
      timeIntents: true,
      realtime: false,
      analytics: false,
    },
    defaultTimeZone: "UTC",
    label: "Logistics",
    summary: "Multi-stop / freight planning (reserved — same envelope contract)",
  },
}

export function getDomainProfile(domain: PlanningDomain): DomainProfile {
  return DOMAIN_PROFILES[domain]
}

export function isLiveDomain(domain: PlanningDomain): boolean {
  return DOMAIN_PROFILES[domain].status === "live"
}

export function assertLiveDomain(domain: PlanningDomain): void {
  const profile = DOMAIN_PROFILES[domain]
  if (profile.status !== "live") {
    throw new Error(
      `Domain "${domain}" is reserved (${profile.summary}). ` +
        `Live today: transit. Schemas reserved: ${profile.schemas.join(", ")}`,
    )
  }
}

/** Type guard for any agent envelope meta. */
export function isAgentEnvelope(value: unknown): value is AgentEnvelopeMeta {
  if (typeof value !== "object" || value == null) return false
  const v = value as Record<string, unknown>
  return typeof v.schema === "string" && (v.domain === "transit" || v.domain === "logistics")
}

/**
 * Shared time-intent vocabulary — domain-agnostic.
 * Transit maps these to MOTIS; logistics will map to lane/SLA windows.
 */
export type SharedTimeIntent =
  | "departAfter"
  | "arriveBy"
  | "leaveBy"
  | "windowPack"
  | "eventEnd"

/**
 * Cross-domain planning principles (docs + agent skills).
 * Keep these stable even when option shapes diverge.
 */
export const HARNESS_PRINCIPLES = [
  "facts_not_picks", // decisionBoundary always agent
  "one_channel", // json XOR markdown
  "schema_plus_domain", // wire identity
  "board_then_expand", // breadth before depth when supported
  "server_fanout", // no client poll storms
  "explicit_time_intent", // arriveBy / departAfter / …
] as const

export type HarnessPrinciple = (typeof HARNESS_PRINCIPLES)[number]
