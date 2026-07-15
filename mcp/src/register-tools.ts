import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { FindStopsRequestSchema, PlaceRefSchema } from "@imtakt/core"
import type { AgentHarness } from "@imtakt/sdk"
import { ImTaktAmbiguousPlaceError } from "@imtakt/sdk"
import { formatToolError, toolError, toolFromFormat, toolJson, toolJsonFromFormat } from "./format.js"

export function registerImTaktTools(server: McpServer, harness: AgentHarness): void {
  server.tool(
    "imtakt_find_station",
    "Resolve a German transit stop by place name or coordinates.",
    {
      place: z.string().min(1).optional().describe("Place or station name"),
      lat: z.number().optional().describe("Latitude (requires lng)"),
      lng: z.number().optional().describe("Longitude (requires lat)"),
      limit: z.number().int().min(1).max(10).optional().describe("Max matches (default 8)"),
      granularity: z.enum(["station", "stop"]).optional().describe("station or stop level"),
    },
    async (input) => {
      try {
        const req = FindStopsRequestSchema.parse(input)
        const result = await harness.client.findStops(req)
        return toolJsonFromFormat(harness.format(result, "find"))
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )

  server.tool(
    "imtakt_plan_journey",
    "Plan a multimodal journey in Germany. Returns up to 3 options with legs, delays, runIds, and snap metadata.",
    {
      from: PlaceRefSchema.describe("Origin — place string, {lat,lng}, or {stopId}"),
      to: PlaceRefSchema.describe("Destination — place string, {lat,lng}, or {stopId}"),
      when: z
        .string()
        .datetime()
        .describe("ISO 8601 UTC departure — ground in system clock"),
      excludeLongDistance: z
        .boolean()
        .optional()
        .describe("Regio only — exclude ICE/IC/EC"),
      presentation: z
        .enum(["json", "markdown"])
        .optional()
        .describe("json (default, agent envelope) or markdown (human cards)"),
    },
    async ({ from, to, when, excludeLongDistance, presentation }) => {
      try {
        const result = await harness.planTrip({
          from,
          to,
          when,
          preferences: { excludeLongDistance: excludeLongDistance ?? false },
        })
        const mode = presentation ?? "json"
        const formatted = harness.format(result, "journey", {
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
    },
  )

  server.tool(
    "imtakt_view_station",
    "View upcoming departures at a stop (schedule board). Prefer imtakt_station_live for realtime asOf.",
    {
      station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
    },
    async ({ station }) => {
      try {
        const resolved = await harness.resolvePlace(station)
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

  server.tool(
    "imtakt_station_live",
    "Full live station view: metadata, departures, and realtime asOf timestamp.",
    {
      station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
      limit: z.number().int().min(1).max(30).optional().describe("Departure count (default 16)"),
      presentation: z.enum(["json", "markdown"]).optional(),
    },
    async ({ station, limit, presentation }) => {
      try {
        const result = await harness.stationStatus(station, { limit })
        const mode = presentation ?? "json"
        const formatted = harness.format(result, "live", {
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
    },
  )

  server.tool(
    "imtakt_view_train",
    "Track a train run by runId from journey or board output.",
    {
      runId: z.string().min(1).describe("Stable run id from plan or board"),
      presentation: z.enum(["json", "markdown"]).optional(),
    },
    async ({ runId, presentation }) => {
      try {
        const result = await harness.viewTrain(runId)
        const mode = presentation ?? "json"
        const formatted = harness.format(result, "train", {
          presentation: mode,
          verbosity: "compact",
        })
        return toolFromFormat(formatted, mode)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )
}
