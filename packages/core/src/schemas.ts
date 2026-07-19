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
  confidence: z.number().min(0).max(1).optional(),
  matchType: MatchTypeSchema.optional(),
  alternatives: z.array(StopMatchSchema).optional(),
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
    modes: z.array(TransitModeSchema).optional(),
    /** station = dedupe to hubs (default); stop = platform-level hits */
    granularity: z.enum(["station", "stop"]).optional(),
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
  /** Scheduled platform before realtime updates (Gl. from GTFS). */
  scheduledPlatform: z.string().optional(),
  cancelled: z.boolean(),
  /** True when MOTIS applied GTFS-RT for this leg. */
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

export const LineClassSchema = z.enum(["long_distance"])

export const JourneyPreferencesSchema = z.object({
  excludeLineClasses: z.array(LineClassSchema).optional(),
  maxTransfers: z.number().int().min(0).max(10).optional(),
  /** Max itineraries returned (board default 20). */
  maxResults: z.number().int().min(1).max(30).optional(),
})

export type JourneyPreferences = z.infer<typeof JourneyPreferencesSchema>

export const FareProfileSchema = z.enum(["any", "regio", "d-ticket"])
export type FareProfile = z.infer<typeof FareProfileSchema>

export const JourneyViewSchema = z.enum(["full", "board"])
export type JourneyView = z.infer<typeof JourneyViewSchema>

export const JourneyPackSchema = z.enum(["windows", "round-trip", "day-chain"])
export type JourneyPack = z.infer<typeof JourneyPackSchema>

export const RealtimeSnapshotSchema = z.object({
  available: z.boolean(),
  asOf: z.string().datetime(),
})

export type RealtimeSnapshot = z.infer<typeof RealtimeSnapshotSchema>

export const TripTimeSchema = z.object({
  intent: z.enum(["departAfter", "arriveBy", "leaveBy", "windowPack", "eventEnd"]),
  anchorUtc: z.string().datetime(),
  anchorLocal: z.string().optional(),
  tz: z.string().optional(),
  windowMinutes: z.number().int().nonnegative().optional(),
  arriveSlackMinutes: z.number().int().optional(),
  departSlackMinutes: z.number().int().optional(),
  serviceDate: z.string().optional(),
  leaveByUtc: z.string().datetime().optional(),
  pageCursor: z.string().optional(),
})

export type TripTime = z.infer<typeof TripTimeSchema>

export const PlanJourneyRequestSchema = z
  .object({
    from: PlaceRefSchema.optional(),
    to: PlaceRefSchema.optional(),
    /** Depart-after UTC ISO (default when no arrive/leaveBy). */
    when: z.string().datetime().optional(),
    /** Arrive-by UTC ISO — MOTIS arriveBy=true. */
    arrive: z.string().datetime().optional(),
    /** Latest acceptable departure UTC ISO. */
    leaveBy: z.string().datetime().optional(),
    /** Meeting/event end — depart after this time. */
    departAfterEvent: z.string().datetime().optional(),
    windowMinutes: z.number().int().min(1).max(24 * 60).optional(),
    arriveSlackMinutes: z.number().int().min(0).max(180).optional(),
    departSlackMinutes: z.number().int().min(0).max(180).optional(),
    minConnectionMinutes: z.number().int().min(0).max(60).optional(),
    nearby: z.boolean().optional(),
    fare: FareProfileSchema.optional(),
    view: JourneyViewSchema.optional(),
    pageCursor: z.string().optional(),
    pack: JourneyPackSchema.optional(),
    /** For pack=windows: "06:00+120m,17:00+120m" (Berlin local or ISO). */
    windows: z.string().optional(),
    /** Comma-separated stops for pack=day-chain. */
    stops: z.string().optional(),
    /** For pack=round-trip. */
    returnAfter: z.string().datetime().optional(),
    dwellMinutes: z.number().int().min(0).max(24 * 60).optional(),
    /** Depart after this ISO (recovery / missed connection). */
    departAfter: z.string().datetime().optional(),
    preferences: JourneyPreferencesSchema.optional(),
  })
  .refine(
    (v) =>
      v.pack === "day-chain"
        ? !!(v.stops && v.stops.split(",").filter(Boolean).length >= 2)
        : !!(v.from && v.to),
    { message: "from and to are required (or stops for day-chain pack)" },
  )
  .refine(
    (v) =>
      !!(v.when || v.arrive || v.leaveBy || v.departAfterEvent || v.departAfter || v.pack),
    {
      message: "One of when, arrive, leaveBy, departAfterEvent, departAfter, or pack is required",
    },
  )

export type PlanJourneyRequest = z.infer<typeof PlanJourneyRequestSchema>

export const PreferencesAppliedSchema = z.object({
  excludeLineClasses: z.boolean().optional(),
  maxTransfers: z.number().optional(),
  fare: FareProfileSchema.optional(),
  nearby: z.boolean().optional(),
  view: JourneyViewSchema.optional(),
})

export const PlanJourneyClusterSchema = z.object({
  origins: z.array(z.string()),
  destinations: z.array(z.string()),
})

export const PlanJourneyAlternativesSchema = z.object({
  nearbyOriginsTried: z.array(z.string()).optional(),
  fasterWithSurcharge: z
    .array(z.object({ summary: z.string(), optionId: z.string().optional() }))
    .optional(),
})

export const BoardOptionSchema = z.object({
  optionId: z.string(),
  departLocal: z.string(),
  arriveLocal: z.string(),
  depart: z.string().datetime(),
  arrive: z.string().datetime(),
  durationMinutes: z.number().int(),
  changes: z.number().int(),
  lines: z.array(z.string()),
  fareOk: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  connectionScore: z.number().int().min(0).max(100),
  originStop: z.string(),
  destStop: z.string(),
  tags: z.array(z.string()),
  arriveSlackMinutes: z.number().int().optional(),
  departSlackMinutes: z.number().int().optional(),
})

export const PlanJourneyResponseSchema = z.object({
  journeys: z.array(JourneySchema),
  meta: PlanJourneyMetaSchema.optional(),
  realtime: RealtimeSnapshotSchema.optional(),
  attribution: z.string().optional(),
  preferencesApplied: PreferencesAppliedSchema.optional(),
  time: TripTimeSchema.optional(),
  cluster: PlanJourneyClusterSchema.optional(),
  alternatives: PlanJourneyAlternativesSchema.optional(),
  warnings: z.array(z.string()).optional(),
  /** Present when view=board — thin options (also built client-side). */
  board: z
    .object({
      schema: z.literal("imtakt.agent.board/v1"),
      options: z.array(BoardOptionSchema),
      meta: z.object({
        windowMinutes: z.number(),
        returned: z.number(),
        truncated: z.boolean(),
        latestSafeOptionId: z.string().optional(),
      }),
    })
    .optional(),
  /** Opaque optionId → journey index mapping for expand (server cache key). */
  optionIds: z.array(z.string()).optional(),
})

export type PlanJourneyResponse = z.infer<typeof PlanJourneyResponseSchema>

export const ExpandJourneyRequestSchema = z.object({
  optionId: z.string().min(1),
})

export type ExpandJourneyRequest = z.infer<typeof ExpandJourneyRequestSchema>

export const BoardDepartureSchema = z.object({
  line: LineSchema,
  direction: z.string(),
  plannedTime: z.string().datetime(),
  predictedTime: z.string().datetime().optional(),
  platform: z.string().optional(),
  scheduledPlatform: z.string().optional(),
  delayMinutes: z.number().int(),
  cancelled: z.boolean(),
  /** Whole trip cancelled (not just this stop). */
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

export const StationDetailSchema = StopSchema.extend({
  shortCode: z.string().optional(),
  modes: z.array(TransitModeSchema),
})

export type StationDetail = z.infer<typeof StationDetailSchema>

export const StationLiveResponseSchema = z.object({
  station: StationDetailSchema,
  departures: z.array(BoardDepartureSchema),
  realtime: RealtimeSnapshotSchema,
  attribution: z.string().optional(),
})

export type StationLiveResponse = z.infer<typeof StationLiveResponseSchema>

export const TrainProgressStatusSchema = z.enum([
  "not_departed",
  "in_transit",
  "at_stop",
  "completed",
  "cancelled",
])

export type TrainProgressStatus = z.infer<typeof TrainProgressStatusSchema>

export const TrainProgressSchema = z.object({
  status: TrainProgressStatusSchema,
  currentStopIndex: z.number().int().nullable(),
  currentStop: StopSchema.optional(),
  nextStop: StopSchema.optional(),
})

export type TrainProgress = z.infer<typeof TrainProgressSchema>

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
  asOf: z.string().datetime(),
  progress: TrainProgressSchema,
})

export type ViewTrainResponse = z.infer<typeof ViewTrainResponseSchema>

export const GTFS_SCHEDULE_ATTRIBUTION =
  "Schedule data © gtfs.de contributors (CC BY 4.0)."

export const GTFS_RT_ATTRIBUTION_SUFFIX =
  "Realtime data where shown © gtfs.de (CC BY-SA 4.0)."

export const GTFS_ATTRIBUTION = `${GTFS_SCHEDULE_ATTRIBUTION} ${GTFS_RT_ATTRIBUTION_SUFFIX}`

/** Schedule-only vs full attribution when realtime fields are present in the response. */
export function attributionForResponse(hasRealtime: boolean): string {
  return hasRealtime ? GTFS_ATTRIBUTION : GTFS_SCHEDULE_ATTRIBUTION
}
