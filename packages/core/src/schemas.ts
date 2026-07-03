import { z } from "zod"

export const TransitModeSchema = z.enum([
  "rail",
  "bus",
  "tram",
  "metro",
  "ferry",
  "other",
])

export type TransitMode = z.infer<typeof TransitModeSchema>

export const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
})

export type Location = z.infer<typeof LocationSchema>

export const StopSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: LocationSchema,
  modes: z.array(TransitModeSchema).optional(),
})

export type Stop = z.infer<typeof StopSchema>

export const MatchTypeSchema = z.enum(["exact", "fuzzy", "semantic", "geo"])

export type MatchType = z.infer<typeof MatchTypeSchema>

export const StopMatchSchema = StopSchema.extend({
  confidence: z.number().min(0).max(1),
  matchType: MatchTypeSchema,
  /** Canonical station id (search results collapse platforms to this). */
  stationId: z.string().optional(),
  stationName: z.string().optional(),
  shortCode: z.string().optional(),
  /** Platform-level stop name when different from station. */
  stopName: z.string().optional(),
  /** Platform-level stop id. */
  stopId: z.string().optional(),
  parentStopId: z.string().optional(),
})

export type StopMatch = z.infer<typeof StopMatchSchema>

/** Place name, coordinates, or stable stop ID — used for journey endpoints */
export const PlaceRefSchema = z.union([
  z.string().min(1),
  LocationSchema,
  z.object({ stopId: z.string().min(1) }),
])

export type PlaceRef = z.infer<typeof PlaceRefSchema>

export const JourneyEndpointSnapSchema = z.object({
  requested: PlaceRefSchema,
  snappedStop: StopSchema,
  walkMeters: z.number().int().nonnegative().optional(),
})

export type JourneyEndpointSnap = z.infer<typeof JourneyEndpointSnapSchema>

export const PlanJourneyMetaSchema = z.object({
  from: JourneyEndpointSnapSchema,
  to: JourneyEndpointSnapSchema,
})

export type PlanJourneyMeta = z.infer<typeof PlanJourneyMetaSchema>

export const FindStopsRequestSchema = z
  .object({
    place: z.string().min(1).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .refine(
    (v) => (v.place != null && v.place.length > 0) || (v.lat != null && v.lng != null),
    { message: "Either place or lat+lng is required" },
  )

export type FindStopsRequest = z.infer<typeof FindStopsRequestSchema>

export const FindStopsResponseSchema = z.object({
  matches: z.array(StopMatchSchema),
  attribution: z.string().optional(),
})

export type FindStopsResponse = z.infer<typeof FindStopsResponseSchema>

export const LineSchema = z.object({
  name: z.string(),
  mode: TransitModeSchema,
})

export type Line = z.infer<typeof LineSchema>

export const LegSchema = z.object({
  origin: StopSchema,
  destination: StopSchema,
  plannedDeparture: z.string().datetime(),
  departure: z.string().datetime(),
  arrival: z.string().datetime(),
  delayMinutes: z.number().int(),
  line: LineSchema,
  platform: z.string().optional(),
  scheduledPlatform: z.string().optional(),
  cancelled: z.boolean(),
  realTime: z.boolean().optional(),
  /** Stable train run id — use with imtakt_view_train. */
  runId: z.string().optional(),
})

export type Leg = z.infer<typeof LegSchema>

export const JourneySchema = z.object({
  legs: z.array(LegSchema),
  durationMinutes: z.number().int().nonnegative(),
  transfers: z.number().int().nonnegative(),
})

export type Journey = z.infer<typeof JourneySchema>

export const PlanJourneyRequestSchema = z.object({
  from: PlaceRefSchema,
  to: PlaceRefSchema,
  when: z.string().datetime(),
})

export type PlanJourneyRequest = z.infer<typeof PlanJourneyRequestSchema>

export const PlanJourneyResponseSchema = z.object({
  journeys: z.array(JourneySchema),
  meta: PlanJourneyMetaSchema.optional(),
  attribution: z.string().optional(),
})

export type PlanJourneyResponse = z.infer<typeof PlanJourneyResponseSchema>

export const BoardDepartureSchema = z.object({
  line: LineSchema,
  direction: z.string(),
  plannedTime: z.string().datetime(),
  predictedTime: z.string().datetime().optional(),
  platform: z.string().optional(),
  scheduledPlatform: z.string().optional(),
  delayMinutes: z.number().int(),
  cancelled: z.boolean(),
  tripCancelled: z.boolean().optional(),
  realTime: z.boolean().optional(),
  /** Stable train run id — use with imtakt_view_train. */
  runId: z.string().optional(),
})

export type BoardDeparture = z.infer<typeof BoardDepartureSchema>

export const StationBoardResponseSchema = z.object({
  stop: StopSchema,
  departures: z.array(BoardDepartureSchema),
  attribution: z.string().optional(),
})

export type StationBoardResponse = z.infer<typeof StationBoardResponseSchema>

export const TrainStopObservationSchema = z.object({
  stop: StopSchema,
  plannedArrival: z.string().datetime().optional(),
  arrival: z.string().datetime().optional(),
  plannedDeparture: z.string().datetime().optional(),
  departure: z.string().datetime().optional(),
  platform: z.string().optional(),
  scheduledPlatform: z.string().optional(),
  delayMinutes: z.number().int(),
  cancelled: z.boolean(),
  realTime: z.boolean().optional(),
})

export type TrainStopObservation = z.infer<typeof TrainStopObservationSchema>

export const ViewTrainResponseSchema = z.object({
  runId: z.string(),
  line: LineSchema,
  direction: z.string(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stops: z.array(TrainStopObservationSchema),
  currentDelayMinutes: z.number().int(),
  cancelled: z.boolean(),
  realTime: z.boolean().optional(),
  attribution: z.string().optional(),
})

export type ViewTrainResponse = z.infer<typeof ViewTrainResponseSchema>

export const GTFS_ATTRIBUTION =
  "Schedule data © gtfs.de contributors (CC BY 4.0). Realtime data where shown © gtfs.de (CC BY-SA 4.0)."
