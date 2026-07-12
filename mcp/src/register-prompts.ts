import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

/**
 * MCP prompts — reusable trip-planning workflows for agents.
 *
 * Core rule baked into every prompt: ground "when" in the SYSTEM CLOCK
 * (run `date -u +%Y-%m-%dT%H:%M:%SZ` or equivalent) — never guess the
 * current date, and never reuse a stale timestamp from earlier context.
 */

const TIME_GROUNDING = `Before calling imtakt_plan_journey:
1. Get the CURRENT time from the system clock (shell: \`date -u +%Y-%m-%dT%H:%M:%SZ\`; JS: \`new Date().toISOString()\`). Never guess the date or reuse a timestamp from earlier conversation.
2. If the user gave a relative time ("in 20 minutes", "tomorrow 9am"), compute it FROM that system time. German local times are Europe/Berlin (CET/CEST) — convert to ISO 8601 UTC for the \`when\` field.
3. Pass \`when\` as ISO 8601 (e.g. 2026-07-03T09:30:00Z).`

const PRESENTATION = `When presenting journeys:
- Show ALL returned options, not just the first. Label the fastest, the earliest arrival, and the next departure.
- Times in Europe/Berlin HH:MM. Mention the date if it's not today.
- Per leg: line name, departure/arrival, platform (Gl.) when present.
- Realtime: \`realTime: true\` legs carry live data — surface \`delayMinutes\` (e.g. "+5 min") and \`cancelled\` warnings prominently. Never claim live status for legs without realTime.
- Flag tight transfers (< 5 min between arrival and next departure).
- Keep each leg's \`runId\` available for follow-ups via imtakt_view_train.`

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

Workflow:
1. Resolve ambiguous places with imtakt_find_station first (skip for unambiguous names like "Berlin Hbf" — imtakt_plan_journey resolves strings itself).
2. Call imtakt_plan_journey with from, to, and the computed \`when\`.
3. If the first leg departs very soon (< 10 min), also call imtakt_view_station on the origin to double-check the live board.

${PRESENTATION}

Close with a clear recommendation (which option and why — speed vs. transfers vs. realtime reliability).`,
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
2. Call imtakt_view_station (it resolves names itself; use imtakt_find_station only if the name is ambiguous).
3. Present each departure: Berlin local HH:MM, line, direction, platform if present, "+N min" delay when realTime, and relative time from now. Flag cancellations first.
4. Offer to follow a specific train via its runId (imtakt_view_train).`,
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

Workflow:
1. Plan outbound with imtakt_plan_journey.
2. Take the chosen outbound option's LAST leg \`arrival\` (ISO). Add the stay duration (default 60 min). Use that as \`when\` for the return imtakt_plan_journey call — never reuse the outbound departure time.
3. Verify the return's first departure is at or after arrival + stay.

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
2. Call imtakt_view_train with the runId.
3. Present the stop list: Berlin HH:MM arrival/departure, platform, +delay per stop where realTime, and highlight the NEXT stop relative to now. Flag cancellations.`,
          },
        },
      ],
    }),
  )
}
