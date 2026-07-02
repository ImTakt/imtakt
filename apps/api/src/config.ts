const isProduction = process.env.NODE_ENV === "production" || process.env.BUN_ENV === "production"

export const MAX_SNAP_RADIUS_M = 1500
export const DEFAULT_JOURNEY_OPTIONS = 3
export const DEFAULT_STOP_MATCHES = 3
export const DEFAULT_BOARD_DEPARTURES = 8
export const MAX_TRANSFERS = 5

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  meiliUrl: process.env.MEILI_URL ?? "http://localhost:7700",
  meiliKey: process.env.MEILI_MASTER_KEY,
  meiliIndex: process.env.MEILI_INDEX ?? "stops",
  motisUrl: process.env.MOTIS_URL ?? "http://localhost:8080",
  motisDatasetTag: process.env.MOTIS_DATASET_TAG ?? "de",
  archiveEnabled: process.env.IMTAKT_ARCHIVE === "1",
  archivePath: process.env.IMTAKT_ARCHIVE_PATH ?? "./data/archive/responses.sqlite",
  semanticRerank: process.env.IMTAKT_SEMANTIC_RERANK !== "0",
  feedManifestPath: process.env.FEED_MANIFEST_PATH ?? "",
  feedMaxAgeHours: Number(process.env.FEED_MAX_AGE_HOURS ?? "48"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Health probe cache — reduces load from Railway/K8s (seconds). */
  healthCacheSec: Number(process.env.HEALTH_CACHE_SEC ?? (isProduction ? "10" : "2")),
  /** Feed manifest cache (seconds). */
  feedCacheSec: Number(process.env.FEED_CACHE_SEC ?? "30"),
  maxRequestBodyBytes: Number(process.env.MAX_REQUEST_BODY_BYTES ?? String(1024 * 1024)),
  reusePort: process.env.BUN_REUSE_PORT === "1",
}
