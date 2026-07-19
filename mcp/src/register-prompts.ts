import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

/**
 * MCP prompts — reusable trip-planning workflows for agents.
 *
 * Core rule baked into every prompt: ground "when" in the SYSTEM CLOCK
 * (run `date -u +%Y-%m-%dT%H:%M:%SZ` or equivalent) — never guess the
 * current date, and never reuse a stale timestamp from earlier context.
 */

const TIME_GROUNDING = `Before calling imtakt_plan:
1. Get the CURRENT time from the system clock (shell: \`date -u +%Y-%m-%dT%H:%M:%SZ\`; JS: \`new Date().toISOString()\`). Never guess the date.
2. Prefer \`arrive\` for office/meeting ("be there by 08:00") — pass Berlin local HH:MM + date, or ISO UTC. Use \`when\` only for depart-after.
3. Do NOT poll every 3–5 minutes with different \`when\` values. Use \`view: "board"\`, \`windowMinutes: 120\`, \`nearby: true\`, \`fare: "d-ticket"\` in one call.`

const PRESENTATION = `When presenting journeys (time-first):
- First call returns \`imtakt.agent.board/v1\` — thin options (leave/arrive/lines/connectionScore/arriveSlackMinutes). No legs.
- Pick using \`latest_safe\` / \`arriveSlackMinutes\` / \`connectionScore\`. Then call \`imtakt_show\` with \`optionId\` for full legs.
- Times: Europe/Berlin via \`departLocal\` / \`arriveLocal\`. Mention the date if not today.
- On empty D-Ticket board: show \`alternatives.fasterWithSurcharge\` once — do not drop fare silently.
- After expand: platforms, \`transferGaps\`, \`riskSignals\`, \`runId\` for imtakt_follow.
- Flow: plan → show → follow (never poll loops).`

export function registerImTaktPrompts(server: McpServer): void {
  server.prompt(
    "plan_trip",
    "Plan a door-to-door German transit trip with all options, realtime delays, and correct time grounding.",
    {
      from: z.string().describe("Origin — station name, address area, or 'lat,lng'"),
      to: z.string().describe("Destination — station name, address area, or 'lat,lng'"),
      when: z
        .string()
        .optional()
        .describe("Departure intent in the user's words (e.g. 'now', 'tomorrow 9am', '14:30')"),
    },
    ({ from, to, when }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Plan a German transit trip from "${from}" to "${to}"${when ? ` departing ${when}` : " departing now"}.

${TIME_GROUNDING}

Workflow (≤2 tool calls):
1. Call imtakt_plan with from, to, arrive or when, view="board", nearby=true, fare as needed, windowMinutes=120.
2. Recommend leave time from board (latest_safe). Optionally imtakt_show for the chosen optionId.

${PRESENTATION}

Close with a clear recommendation (leave time, arrive, slack, fareOk — you choose for the user).`,
          },
        },
      ],
    }),
  )

  server.prompt(
    "next_departures",
    "Live departure board for a station with realtime delays, grounded in current system time.",
    {
      station: z.string().describe("Station name, stop ID, or 'lat,lng'"),
    },
    ({ station }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Show upcoming departures at "${station}".

1. Get current system time first (\`date -u +%Y-%m-%dT%H:%M:%SZ\`) so you can say "in N min" for each departure.
2. Call imtakt_status (it resolves names itself; use imtakt_find only if the name is ambiguous).
3. Present each departure: Berlin local HH:MM, line, direction, platform if present, "+N min" delay when realTime, and relative time from now. Flag cancellations first.
4. Offer to follow a specific train via its runId (imtakt_follow).`,
          },
        },
      ],
    }),
  )

  server.prompt(
    "round_trip",
    "Plan an out-and-back trip; the return is planned FROM the outbound arrival time.",
    {
      from: z.string().describe("Home/origin station"),
      to: z.string().describe("Destination station"),
      when: z.string().optional().describe("Outbound departure intent (default: now)"),
      stayMinutes: z
        .string()
        .optional()
        .describe("Minutes to stay at the destination before returning (default 60)"),
    },
    ({ from, to, when, stayMinutes }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Plan a round trip ${from} → ${to} → ${from}${when ? `, leaving ${when}` : ", leaving now"}${stayMinutes ? `, staying ~${stayMinutes} min` : ""}.

${TIME_GROUNDING}

Preferred: one pack call via CLI \`plan --pack round-trip\` when available. Otherwise:
1. Board outbound with imtakt_plan (view=board).
2. Expand winner with imtakt_show; use last leg arrival + stay as return \`when\`.
3. Board return; verify first depart ≥ arrival + stay.

${PRESENTATION}

Present outbound and return separately, then total time away including the stay.`,
          },
        },
      ],
    }),
  )

  server.prompt(
    "follow_train",
    "View a specific train run — stops, delays, platforms.",
    {
      runId: z.string().describe("runId from a journey leg or board departure"),
    },
    ({ runId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `View train run ${runId}.

1. Get current system time (\`date -u\`) to compute "in N min" per stop.
2. Call imtakt_follow with the runId.
3. Present the stop list: Berlin HH:MM arrival/departure, platform, +delay per stop where realTime, and highlight the NEXT stop relative to now. Flag cancellations.`,
          },
        },
      ],
    }),
  )
}
