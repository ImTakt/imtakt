import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { FindStopsRequestSchema, PlaceRefSchema } from "@imtakt/core"
import type { AgentHarness } from "@imtakt/sdk"
import { ImTaktAmbiguousPlaceError } from "@imtakt/sdk"
import { formatToolError, toolError, toolFromFormat, toolJson, toolJsonFromFormat } from "./format.js"

const whenDesc =
  "Friendly or ISO time: now, +25m, 08:00 (Europe/Berlin), 20.07.2026 08:00, or ISO UTC. Prefer arrive for office commute."

const findInput = {
  place: z.string().min(1).optional().describe("Place or station name"),
  lat: z.number().optional().describe("Latitude (requires lng)"),
  lng: z.number().optional().describe("Longitude (requires lat)"),
  limit: z.number().int().min(1).max(10).optional().describe("Max matches (default 8)"),
  granularity: z.enum(["station", "stop"]).optional().describe("station or stop level"),
}

const planInput = {
  from: PlaceRefSchema.describe("Origin — place string, {lat,lng}, or {stopId}"),
  to: PlaceRefSchema.describe("Destination — place string, {lat,lng}, or {stopId}"),
  when: z.string().optional().describe(`Depart after. ${whenDesc}`),
  arrive: z.string().optional().describe(`Arrive by (office/meeting). ${whenDesc}`),
  leaveBy: z.string().optional().describe(`Latest departure. ${whenDesc}`),
  date: z.string().optional().describe("YYYY-MM-DD to compose with HH:MM Berlin local"),
  fare: z.enum(["any", "regio", "d-ticket"]).optional().describe("d-ticket = Deutschlandticket (no ICE)"),
  nearby: z.boolean().optional().describe("Expand nearby stops (Messe Süd/Nord). Default true for board."),
  view: z.enum(["board", "full"]).optional().describe("board = thin options (default for agents); full = legs"),
  windowMinutes: z.number().int().min(1).max(1440).optional().describe("Search window minutes (default 120 on board)"),
  arriveSlackMinutes: z.number().int().min(0).max(180).optional(),
  excludeLongDistance: z.boolean().optional().describe("Alias for fare=regio"),
  presentation: z
    .enum(["json", "markdown"])
    .optional()
    .describe("json (default, agent envelope) or markdown"),
}

const showInput = {
  optionId: z.string().min(1).describe("optionId from board response"),
  presentation: z.enum(["json", "markdown"]).optional(),
}

const statusInput = {
  station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
  limit: z.number().int().min(1).max(30).optional().describe("Departure count (default 16)"),
  presentation: z.enum(["json", "markdown"]).optional(),
}

const followInput = {
  runId: z.string().min(1).describe("Stable run id from plan or board"),
  presentation: z.enum(["json", "markdown"]).optional(),
}

export function registerImTaktTools(server: McpServer, harness: AgentHarness): void {
  const findHandler = async (input: {
    place?: string
    lat?: number
    lng?: number
    limit?: number
    granularity?: "station" | "stop"
  }) => {
    try {
      const req = FindStopsRequestSchema.parse(input)
      const result = await harness.client.findStops(req)
      return toolJsonFromFormat(harness.format(result, "find"))
    } catch (err) {
      return toolError(formatToolError(err))
    }
  }

  const planHandler = async (input: {
    from: z.infer<typeof PlaceRefSchema>
    to: z.infer<typeof PlaceRefSchema>
    when?: string
    arrive?: string
    leaveBy?: string
    date?: string
    fare?: "any" | "regio" | "d-ticket"
    nearby?: boolean
    view?: "board" | "full"
    windowMinutes?: number
    arriveSlackMinutes?: number
    excludeLongDistance?: boolean
    presentation?: "json" | "markdown"
  }) => {
    try {
      const view = input.view ?? "board"
      const result = await harness.plan({
        from: input.from,
        to: input.to,
        when: input.when,
        arrive: input.arrive,
        leaveBy: input.leaveBy,
        date: input.date,
        preferences: {
          excludeLongDistance:
            input.excludeLongDistance === true ||
            input.fare === "d-ticket" ||
            input.fare === "regio",
          fare: input.fare,
          nearby: input.nearby ?? view === "board",
          view,
          windowMinutes: input.windowMinutes ?? (view === "board" ? 120 : undefined),
          arriveSlackMinutes: input.arriveSlackMinutes,
          maxResults: view === "board" ? 10 : undefined,
        },
      })
      if ("pack" in result) {
        return toolJson(result.pack)
      }
      const mode = input.presentation ?? "json"
      const formatted = harness.format(result, "plan", {
        presentation: mode,
        verbosity: "compact",
      })
      return toolFromFormat(formatted, mode)
    } catch (err) {
      if (err instanceof ImTaktAmbiguousPlaceError) {
        return toolError(
          `${err.message}\nCandidates:\n${err.candidates.map((c) => `- ${c.name} (${c.id})`).join("\n")}`,
        )
      }
      return toolError(formatToolError(err))
    }
  }

  const showHandler = async ({
    optionId,
    presentation,
  }: {
    optionId: string
    presentation?: "json" | "markdown"
  }) => {
    try {
      const result = await harness.show(optionId)
      const mode = presentation ?? "json"
      const formatted = harness.format(result, "plan", {
        presentation: mode,
        verbosity: "compact",
      })
      return toolFromFormat(formatted, mode)
    } catch (err) {
      return toolError(formatToolError(err))
    }
  }

  const statusHandler = async ({
    station,
    limit,
    presentation,
  }: {
    station: z.infer<typeof PlaceRefSchema>
    limit?: number
    presentation?: "json" | "markdown"
  }) => {
    try {
      const result = await harness.status(station, { limit })
      const mode = presentation ?? "json"
      const formatted = harness.format(result, "status", {
        presentation: mode,
        verbosity: "compact",
      })
      return toolFromFormat(formatted, mode)
    } catch (err) {
      if (err instanceof ImTaktAmbiguousPlaceError) {
        return toolError(err.message)
      }
      return toolError(formatToolError(err))
    }
  }

  const followHandler = async ({
    runId,
    presentation,
  }: {
    runId: string
    presentation?: "json" | "markdown"
  }) => {
    try {
      const result = await harness.follow(runId)
      const mode = presentation ?? "json"
      const formatted = harness.format(result, "follow", {
        presentation: mode,
        verbosity: "compact",
      })
      return toolFromFormat(formatted, mode)
    } catch (err) {
      return toolError(formatToolError(err))
    }
  }

  // Primary five-verb surface
  server.tool("imtakt_find", "Resolve a place (stop / station) by name or coordinates.", findInput, findHandler)
  server.tool(
    "imtakt_plan",
    "Time-first plan board or full. Prefer view=board + arrive (≤2 tool calls). Flow: plan → show → follow. Do NOT poll with when.",
    planInput,
    planHandler,
  )
  server.tool(
    "imtakt_show",
    "Expand a board optionId to full imtakt.agent.plan/v1 (legs, platforms, risk detail).",
    showInput,
    showHandler,
  )
  server.tool(
    "imtakt_status",
    "Live / local observation at a place: departures + realtime asOf.",
    statusInput,
    statusHandler,
  )
  server.tool(
    "imtakt_follow",
    "Follow a train run by runId from plan or board output.",
    followInput,
    followHandler,
  )

  // Deprecated aliases (same handlers; remove after one minor version)
  server.tool(
    "imtakt_find_station",
    "[Deprecated: use imtakt_find] Resolve a German transit stop by place name or coordinates.",
    findInput,
    findHandler,
  )
  server.tool(
    "imtakt_plan_journey",
    "[Deprecated: use imtakt_plan] Time-first journey board or full plan.",
    planInput,
    planHandler,
  )
  server.tool(
    "imtakt_journey_show",
    "[Deprecated: use imtakt_show] Expand a board optionId to full plan/v1.",
    showInput,
    showHandler,
  )
  server.tool(
    "imtakt_station_live",
    "[Deprecated: use imtakt_status] Full live station view.",
    statusInput,
    statusHandler,
  )
  server.tool(
    "imtakt_view_train",
    "[Deprecated: use imtakt_follow] Track a train run by runId.",
    followInput,
    followHandler,
  )

  server.tool(
    "imtakt_view_station",
    "[Deprecated: prefer imtakt_status] Schedule board without live asOf emphasis.",
    {
      station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
    },
    async ({ station }) => {
      try {
        const resolved = await harness.find(station)
        const result = await harness.client.stationBoard(resolved.stopId)
        return toolJson(result)
      } catch (err) {
        if (err instanceof ImTaktAmbiguousPlaceError) {
          return toolError(err.message)
        }
        return toolError(formatToolError(err))
      }
    },
  )
}
