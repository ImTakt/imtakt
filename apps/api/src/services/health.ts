import { config } from "../config"
import { createTtlCache } from "../lib/ttl-cache"
import { getFeedMeta } from "./feed-meta"
import { pingDb } from "./stops-db"
import { meiliClient } from "../lib/http-client"

export type HealthStatus = {
  ok: boolean
  capabilities: {
    stops: { ok: boolean; indexed?: number; indexing?: boolean }
    journeys: { ok: boolean }
    board: { ok: boolean }
  }
  feed: Awaited<ReturnType<typeof getFeedMeta>> | { available: false }
  _ops?: {
    search: { ok: boolean; documents?: number; indexing?: boolean; error?: string }
    routing: { ok: boolean; error?: string }
    catalog?: { ok: boolean }
  }
}

const healthCache = createTtlCache<HealthStatus>(config.healthCacheSec * 1000)

async function probeHealth(): Promise<HealthStatus> {
  const feed = await getFeedMeta()

  let stopsOk = false
  let indexed: number | undefined
  let indexing: boolean | undefined
  let searchError: string | undefined

  try {
    const stats = await meiliClient.getJson<{
      numberOfDocuments: number
      isIndexing: boolean
    }>(`/indexes/${config.meiliIndex}/stats`)
    indexed = stats.numberOfDocuments
    indexing = stats.isIndexing
    stopsOk = stats.numberOfDocuments > 0 && !stats.isIndexing
  } catch (err) {
    searchError = err instanceof Error ? err.message : "unreachable"
  }

  let routingOk = false
  let routingError: string | undefined
  try {
    const res = await fetch(`${config.motisUrl}/api/v6/status`, {
      signal: AbortSignal.timeout(2500),
    })
    routingOk = res.ok
    if (!res.ok) routingError = `status ${res.status}`
  } catch (err) {
    routingError = err instanceof Error ? err.message : "unreachable"
  }

  const status: HealthStatus = {
    ok: stopsOk,
    capabilities: {
      stops: { ok: stopsOk, indexed, indexing },
      journeys: { ok: routingOk },
      board: { ok: routingOk },
    },
    feed: feed ?? { available: false },
  }

  if (process.env.IMTAKT_OPS_HEALTH === "1") {
    status._ops = {
      search: { ok: stopsOk, documents: indexed, indexing, error: searchError },
      routing: { ok: routingOk, error: routingError },
      catalog: { ok: await pingDb() },
    }
  }

  return status
}

export async function getHealthStatus(): Promise<HealthStatus> {
  return healthCache.get(probeHealth)
}

/** Call after feed reindex so health reflects new catalog immediately. */
export function invalidateHealthCache(): void {
  healthCache.clear()
}
