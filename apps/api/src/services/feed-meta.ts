import { config } from "../config"

export type FeedMeta = {
  feed: string
  source: string
  feedVersion: string
  publisher: string
  stopCount: number
  fingerprint: string
  syncedAt: string
  indexedAt?: string
  stale: boolean
  maxAgeHours: number
}

type FeedManifest = {
  feed: string
  source: string
  feedVersion: string
  publisher: string
  stopCount: number
  fingerprint: string
  syncedAt: string
  indexedAt?: string
}

const DEFAULT_MAX_AGE_HOURS = 48

let cached: { meta: FeedMeta; mtimeMs: number; expires: number } | null = null

function manifestToMeta(manifest: FeedManifest): FeedMeta {
  const indexedAt = manifest.indexedAt ?? manifest.syncedAt
  const ageMs = Date.now() - new Date(indexedAt).getTime()
  const maxAgeMs = (config.feedMaxAgeHours ?? DEFAULT_MAX_AGE_HOURS) * 3600_000
  return {
    feed: manifest.feed,
    source: manifest.source,
    feedVersion: manifest.feedVersion,
    publisher: manifest.publisher,
    stopCount: manifest.stopCount,
    fingerprint: manifest.fingerprint,
    syncedAt: manifest.syncedAt,
    indexedAt: manifest.indexedAt,
    stale: ageMs > maxAgeMs,
    maxAgeHours: config.feedMaxAgeHours ?? DEFAULT_MAX_AGE_HOURS,
  }
}

export async function getFeedMeta(): Promise<FeedMeta | null> {
  const path = config.feedManifestPath
  if (!path) return null

  const file = Bun.file(path)
  if (!(await file.exists())) return null

  const now = Date.now()
  const stat = await file.stat()
  if (cached && cached.expires > now && cached.mtimeMs === stat.mtimeMs) {
    return cached.meta
  }

  const manifest = (await file.json()) as FeedManifest
  const meta = manifestToMeta(manifest)
  cached = { meta, mtimeMs: stat.mtimeMs, expires: now + config.feedCacheSec * 1000 }
  return meta
}

export function invalidateFeedMetaCache(): void {
  cached = null
}
