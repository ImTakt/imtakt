/**
 * Versioned agent envelopes — transit today, logistics later.
 *
 * Same presentation contract (JSON + markdown) across domains:
 * - `schema` pins the wire shape for agents/tools
 * - `domain` selects semantics (OD passenger plan vs freight/route later)
 * - Options stay undecided (`decisionBoundary: "agent"`)
 */

export type PlanningDomain = "transit" | "logistics"

/** Origin–destination passenger plan (DB-style Verbindungen). */
export const PLAN_SCHEMA = "imtakt.agent.plan/v1" as const
export const FIND_SCHEMA = "imtakt.agent.find/v1" as const
export const LIVE_SCHEMA = "imtakt.agent.live/v1" as const
export const TRAIN_SCHEMA = "imtakt.agent.train/v1" as const

/** Select one channel to consume — JSON is the agent/machine primary. */
export type PresentationMode = "json" | "markdown"

export type AgentEnvelopeMeta = {
  schema: string
  domain: PlanningDomain
}
