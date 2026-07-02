import type { StopMatch, TransitMode } from "@imtakt/core"
import { config, DEFAULT_STOP_MATCHES } from "../config"
import { meiliClient } from "../lib/http-client"

export type SearchDocument = {
  id: string
  gtfs_stop_id: string
  motis_stop_id: string
  stop_name: string
  station_name: string
  short_code: string
  aliases: string[]
  location_type: number
  station_id: string
  parent_station_id: string | null
  modes: TransitMode[]
  _geo: { lat: number; lng: number }
}

export type StopDocument = SearchDocument & {
  name: string
  location: { lat: number; lng: number }
  gtfsStopId: string
  motisStopId: string
  locationType: number
  parentStation?: string
}

const RETRIEVE = [
  "id",
  "stop_name",
  "station_name",
  "short_code",
  "aliases",
  "station_id",
  "parent_station_id",
  "modes",
  "_geo",
  "motis_stop_id",
  "location_type",
] as const

function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function docToMatch(doc: SearchDocument, matchType: StopMatch["matchType"], confidence: number): StopMatch {
  const stationName = doc.station_name ?? doc.stop_name ?? doc.short_code ?? "Unknown"
  const stationId = doc.station_id ?? doc.id
  return {
    id: stationId,
    name: stationName,
    location: { lat: doc._geo.lat, lng: doc._geo.lng },
    modes: doc.modes ?? [],
    confidence: Math.min(1, Math.max(0, confidence)),
    matchType,
    stationId,
    stationName,
    shortCode: doc.short_code,
    stopName: doc.stop_name,
    stopId: doc.id,
    parentStopId: stationId,
  }
}

function scoreHit(query: string, hit: SearchDocument): { confidence: number; matchType: StopMatch["matchType"] } {
  const nq = normalize(query)
  const fields = [
    hit.station_name ?? hit.stop_name ?? "",
    hit.short_code ?? "",
    hit.stop_name ?? "",
    ...(hit.aliases ?? []),
  ]
    .filter(Boolean)
    .map(normalize)

  if (fields.some((f) => f === nq)) return { confidence: 1, matchType: "exact" }
  if (fields.some((f) => f.includes(nq) || nq.includes(f))) return { confidence: 0.92, matchType: "fuzzy" }

  if (config.semanticRerank) {
    const tokens = nq.split(" ")
    let best = 0
    for (const field of fields) {
      const ft = new Set(field.split(" "))
      let overlap = 0
      for (const t of tokens) if (ft.has(t)) overlap++
      best = Math.max(best, overlap / Math.max(tokens.length, ft.size, 1))
    }
    if (best > 0.5) return { confidence: 0.55 + best * 0.35, matchType: best > 0.65 ? "semantic" : "fuzzy" }
  }

  return { confidence: 0.65, matchType: "fuzzy" }
}

function dedupeByStation(hits: SearchDocument[], query: string, limit: number): StopMatch[] {
  const bestByStation = new Map<string, { hit: SearchDocument; rank: number; scored: ReturnType<typeof scoreHit> }>()

  hits.forEach((hit, rank) => {
    const stationKey = hit.station_id ?? hit.id
    const scored = scoreHit(query, hit)
    const prev = bestByStation.get(stationKey)
    if (!prev || scored.confidence > prev.scored.confidence || (scored.confidence === prev.scored.confidence && rank < prev.rank)) {
      bestByStation.set(stationKey, { hit, rank, scored })
    }
  })

  return [...bestByStation.values()]
    .sort((a, b) => b.scored.confidence - a.scored.confidence || a.rank - b.rank)
    .slice(0, limit)
    .map(({ hit, scored }) => docToMatch(hit, scored.matchType, scored.confidence))
}

export async function searchStopsByName(
  query: string,
  limit = DEFAULT_STOP_MATCHES,
): Promise<StopMatch[]> {
  const data = await meiliClient.postJson<{ hits: SearchDocument[] }>(
    `/indexes/${config.meiliIndex}/search`,
    {
      q: query,
      limit: Math.max(limit * 8, 40),
      attributesToRetrieve: RETRIEVE,
    },
  )
  return dedupeByStation(data.hits, query, limit)
}

export async function searchStopsByGeo(
  lat: number,
  lng: number,
  limit = DEFAULT_STOP_MATCHES,
  radiusM = 1500,
): Promise<StopMatch[]> {
  const data = await meiliClient.postJson<{ hits: SearchDocument[] }>(
    `/indexes/${config.meiliIndex}/search`,
    {
      q: "",
      filter: `_geoRadius(${lat}, ${lng}, ${radiusM})`,
      sort: [`_geoPoint(${lat}, ${lng}):asc`],
      limit: Math.max(limit * 4, 20),
      attributesToRetrieve: RETRIEVE,
    },
  )
  const byStation = new Map<string, SearchDocument>()
  for (const hit of data.hits) {
    if (!byStation.has(hit.station_id)) byStation.set(hit.station_id, hit)
  }
  return [...byStation.values()]
    .slice(0, limit)
    .map((h, i) => docToMatch(h, "geo", Math.max(0.5, 1 - i * 0.05)))
}

export async function getStopDocumentById(id: string): Promise<StopDocument | null> {
  const res = await fetch(
    `${config.meiliUrl}/indexes/${config.meiliIndex}/documents/${encodeURIComponent(id)}`,
    {
      headers: config.meiliKey ? { authorization: `Bearer ${config.meiliKey}` } : {},
    },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Stop lookup backend unavailable")
  const doc = (await res.json()) as SearchDocument
  return {
    ...doc,
    name: doc.station_name,
    location: { lat: doc._geo.lat, lng: doc._geo.lng },
    gtfsStopId: doc.gtfs_stop_id,
    motisStopId: doc.motis_stop_id,
    locationType: doc.location_type,
    parentStation: doc.parent_station_id ?? undefined,
  }
}

export const getStopById = getStopDocumentById
