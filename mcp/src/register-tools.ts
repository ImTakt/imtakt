import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  FindStopsRequestSchema,
  PlaceRefSchema,
} from "@imtakt/core"
import type { ImTaktClient } from "@imtakt/sdk"
import { formatToolError, toolError, toolJson } from "./format.js"
import { resolveStopId } from "./resolve-station.js"

const FindStationInputSchema = FindStopsRequestSchema

export function registerImTaktTools(server: McpServer, client: ImTaktClient): void {
  server.tool(
    "imtakt_find_station",
    "Resolve a German transit stop by place name or coordinates.",
    {
      place: z.string().min(1).optional().describe("Place or station name"),
      lat: z.number().optional().describe("Latitude (requires lng)"),
      lng: z.number().optional().describe("Longitude (requires lat)"),
    },
    async (input) => {
      try {
        const req = FindStationInputSchema.parse(input)
        const result = await client.findStops(req)
        return toolJson(result)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )

  server.tool(
    "imtakt_plan_journey",
    "Plan a multimodal journey in Germany between two places (name, coordinates, or stop ID). Returns up to 3 options with legs, transfers, realtime delays, and runIds. Ground `when` in the current system clock (e.g. `date -u`) — never guess today's date.",
    {
      from: PlaceRefSchema.describe("Origin — place string, {lat,lng}, or {stopId}"),
      to: PlaceRefSchema.describe("Destination — place string, {lat,lng}, or {stopId}"),
      when: z
        .string()
        .datetime()
        .describe(
          "ISO 8601 UTC departure time. Compute from the CURRENT system clock (`date -u +%Y-%m-%dT%H:%M:%SZ`); convert Europe/Berlin local intents to UTC.",
        ),
    },
    async ({ from, to, when }) => {
      try {
        const result = await client.planJourney({ from, to, when })
        return toolJson(result)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )

  server.tool(
    "imtakt_view_station",
    "View upcoming departures at a German transit stop.",
    {
      station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
    },
    async ({ station }) => {
      try {
        const stopId = await resolveStopId(client, station)
        const result = await client.stationBoard(stopId)
        return toolJson(result)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )

  server.tool(
    "imtakt_station_live",
    "Full live station view: metadata, departures (up to 30), and realtime asOf timestamp.",
    {
      station: PlaceRefSchema.describe("Station name, stop ID, or coordinates"),
      limit: z.number().int().min(1).max(30).optional().describe("Departure count (default 16)"),
    },
    async ({ station, limit }) => {
      try {
        const stopId = await resolveStopId(client, station)
        const result = await client.stationLive(stopId, { limit })
        return toolJson(result)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )

  server.tool(
    "imtakt_view_train",
    "View live full stats for a train run by runId. Includes progress (current/next stop) and asOf freshness.",
    {
      runId: z.string().min(1).describe("Stable train run id from a leg or board departure"),
    },
    async ({ runId }) => {
      try {
        const result = await client.viewTrain(runId)
        return toolJson(result)
      } catch (err) {
        return toolError(formatToolError(err))
      }
    },
  )
}
