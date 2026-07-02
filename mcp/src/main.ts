#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { createImTakt } from "@imtakt/sdk"
import { IMTAKT_HOSTED_API_URL } from "@imtakt/core"

const PlaceRefSchema = z.union([
  z.string().min(1),
  z.object({ lat: z.number(), lng: z.number() }),
  z.object({ stopId: z.string().min(1) }),
])

const server = new McpServer({
  name: "imtakt",
  version: "0.1.0",
})

const imtakt = createImTakt({
  baseUrl: process.env.IMTAKT_SERVER_URL ?? IMTAKT_HOSTED_API_URL,
})

server.tool(
  "imtakt_find_station",
  "Resolve a German transit stop by place name or coordinates.",
  {
    place: z.string().optional().describe("Place or station name"),
    lat: z.number().optional().describe("Latitude"),
    lng: z.number().optional().describe("Longitude"),
  },
  async ({ place, lat, lng }) => {
    const result = await imtakt.findStops(
      place != null ? { place } : { lat: lat!, lng: lng! },
    )
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.tool(
  "imtakt_plan_journey",
  "Plan a multimodal journey in Germany between two places (name, coordinates, or stop ID).",
  {
    from: PlaceRefSchema.describe("Origin — place string, {lat,lng}, or {stopId}"),
    to: PlaceRefSchema.describe("Destination — place string, {lat,lng}, or {stopId}"),
    when: z.string().datetime().optional().describe("ISO departure time"),
  },
  async ({ from, to, when }) => {
    const result = await imtakt.planJourney({ from, to, when })
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
    let stopId: string
    if (typeof station === "string") {
      const found = await imtakt.findStops({ place: station, limit: 1 })
      if (!found.matches[0]) throw new Error(`Station not found: ${station}`)
      stopId = found.matches[0].id
    } else if ("stopId" in station) {
      stopId = station.stopId
    } else {
      const found = await imtakt.findStops({ lat: station.lat, lng: station.lng, limit: 1 })
      if (!found.matches[0]) throw new Error("No stop near coordinates")
      stopId = found.matches[0].id
    }
    const result = await imtakt.stationBoard(stopId)
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.tool(
  "imtakt_travel_time",
  "Get fastest travel time and transfer count between two places in Germany.",
  {
    from: PlaceRefSchema,
    to: PlaceRefSchema,
  },
  async ({ from, to }) => {
    const result = await imtakt.travelTime({ from, to })
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
