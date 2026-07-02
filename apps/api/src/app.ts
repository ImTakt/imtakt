import { Hono } from "hono"
import { compress } from "hono/compress"
import { ZodError } from "zod"
import {
  FindStopsRequestSchema,
  FindStopsResponseSchema,
  GTFS_ATTRIBUTION,
  PlanJourneyRequestSchema,
  PlanJourneyResponseSchema,
  StationBoardResponseSchema,
  TravelTimeRequestSchema,
  TravelTimeResponseSchema,
} from "@imtakt/core"
import { createRoutingProvider } from "./adapters/motis"
import { validationErrorResponse, publicErrorMessage } from "./lib/public-errors"
import { archiveMiddleware } from "./middleware/archive"
import { getFeedMeta } from "./services/feed-meta"
import { getHealthStatus } from "./services/health"
import { searchStopsByGeo, searchStopsByName } from "./services/meilisearch"
import { resolvePlaceRef, toEndpointSnap } from "./services/place-resolver"

const router = createRoutingProvider()

export const app = new Hono()

app.use("*", compress())
app.use("/v1/*", archiveMiddleware)

app.get("/health", async (c) => {
  const status = await getHealthStatus()
  return c.json(status, status.ok ? 200 : 503)
})

app.get("/v1/meta/feed", async (c) => {
  const feed = await getFeedMeta()
  if (!feed) return c.json({ error: "Feed metadata is temporarily unavailable" }, 503)
  return c.json({ ...feed, attribution: GTFS_ATTRIBUTION })
})

app.post("/v1/stops/find", async (c) => {
  try {
    const raw = await c.req.json()
    const parsed = FindStopsRequestSchema.safeParse(raw)
    if (!parsed.success) {
      const { error, status } = validationErrorResponse(parsed.error)
      return c.json({ error }, status)
    }
    const body = parsed.data
    const matches =
      body.place != null
        ? await searchStopsByName(body.place, body.limit)
        : await searchStopsByGeo(body.lat!, body.lng!, body.limit)
    return c.json(
      FindStopsResponseSchema.parse({
        matches,
        attribution: GTFS_ATTRIBUTION,
      }),
    )
  } catch (err) {
    return c.json({ error: publicErrorMessage(err, "Stop search is temporarily unavailable") }, 503)
  }
})

app.post("/v1/stations/find", (c) => {
  const url = new URL(c.req.url)
  url.pathname = "/v1/stops/find"
  return app.fetch(new Request(url, c.req.raw))
})

app.post("/v1/journeys/plan", async (c) => {
  try {
    const raw = await c.req.json()
    const parsed = PlanJourneyRequestSchema.safeParse(raw)
    if (!parsed.success) {
      const { error, status } = validationErrorResponse(parsed.error)
      return c.json({ error }, status)
    }
    const body = parsed.data
    const [fromResolved, toResolved] = await Promise.all([
      resolvePlaceRef(body.from),
      resolvePlaceRef(body.to),
    ])
    const journeys = await router.planJourney(fromResolved, toResolved, {
      when: body.when,
      maxResults: 3,
    })
    return c.json(
      PlanJourneyResponseSchema.parse({
        journeys,
        meta: {
          from: toEndpointSnap(body.from, fromResolved),
          to: toEndpointSnap(body.to, toResolved),
        },
        attribution: GTFS_ATTRIBUTION,
      }),
    )
  } catch (err) {
    if (err instanceof ZodError) {
      const { error, status } = validationErrorResponse(err)
      return c.json({ error }, status)
    }
    return c.json({ error: publicErrorMessage(err, "Journey planning is temporarily unavailable") }, 502)
  }
})

app.post("/v1/journeys/travel-time", async (c) => {
  try {
    const raw = await c.req.json()
    const parsed = TravelTimeRequestSchema.safeParse(raw)
    if (!parsed.success) {
      const { error, status } = validationErrorResponse(parsed.error)
      return c.json({ error }, status)
    }
    const body = parsed.data
    const [fromResolved, toResolved] = await Promise.all([
      resolvePlaceRef(body.from),
      resolvePlaceRef(body.to),
    ])
    const travelTime = await router.travelTime(fromResolved, toResolved)
    return c.json(
      TravelTimeResponseSchema.parse({
        travelTime,
        attribution: GTFS_ATTRIBUTION,
      }),
    )
  } catch (err) {
    return c.json({ error: publicErrorMessage(err, "Journey planning is temporarily unavailable") }, 502)
  }
})

app.get("/v1/stops/:id/board", async (c) => {
  try {
    const resolved = await resolvePlaceRef({ stopId: c.req.param("id") })
    const board = await router.stationBoard(resolved)
    return c.json(
      StationBoardResponseSchema.parse({
        ...board,
        attribution: GTFS_ATTRIBUTION,
      }),
    )
  } catch (err) {
    return c.json({ error: publicErrorMessage(err, "Departure board is temporarily unavailable") }, 502)
  }
})

app.get("/v1/stations/:id/board", (c) => {
  const url = new URL(c.req.url)
  url.pathname = url.pathname.replace("/v1/stations/", "/v1/stops/")
  return app.fetch(new Request(url, c.req.raw))
})
