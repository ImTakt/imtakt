import postgres from "postgres"
import type { TransitMode } from "@imtakt/core"
import { config } from "../config"

export type DbStop = {
  id: string
  gtfsStopId: string
  stopName: string
  stationId: string
  stationName: string
  shortCode: string
  parentStationId: string | null
  locationType: number
  lat: number
  lng: number
  motisStopId: string
  modes: TransitMode[]
}

let sql: ReturnType<typeof postgres> | null = null

function getSql() {
  if (!config.databaseUrl) return null
  if (!sql) {
    sql = postgres(config.databaseUrl, {
      max: Number(process.env.PG_POOL_MAX ?? "10"),
      idle_timeout: 30,
      connect_timeout: 10,
    })
  }
  return sql
}

function mapRow(row: Record<string, unknown>): DbStop {
  return {
    id: String(row.id),
    gtfsStopId: String(row.gtfs_stop_id),
    stopName: String(row.stop_name),
    stationId: String(row.station_id),
    stationName: String(row.station_name),
    shortCode: String(row.short_code),
    parentStationId: row.parent_station_id ? String(row.parent_station_id) : null,
    locationType: Number(row.location_type),
    lat: Number(row.lat),
    lng: Number(row.lng),
    motisStopId: String(row.motis_stop_id),
    modes: (row.modes as TransitMode[]) ?? [],
  }
}

export function isDbConfigured(): boolean {
  return Boolean(config.databaseUrl)
}

export async function getStopById(id: string): Promise<DbStop | null> {
  const db = getSql()
  if (!db) return null
  const rows = await db`
    SELECT s.*, st.name AS station_name, st.short_code
    FROM stops s
    JOIN stations st ON st.id = s.station_id
    WHERE s.id = ${id}
    LIMIT 1
  `
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getPrimaryStopForStation(stationId: string): Promise<DbStop | null> {
  const db = getSql()
  if (!db) return null
  const rows = await db`
    SELECT s.*, st.name AS station_name, st.short_code
    FROM stops s
    JOIN stations st ON st.id = s.station_id
    WHERE s.station_id = ${stationId}
    ORDER BY s.location_type DESC,
      CASE WHEN 'rail' = ANY(s.modes) THEN 0 ELSE 1 END,
      s.stop_name
    LIMIT 1
  `
  return rows[0] ? mapRow(rows[0]) : null
}

export async function pingDb(): Promise<boolean> {
  const db = getSql()
  if (!db) return false
  try {
    await db`SELECT 1`
    return true
  } catch {
    return false
  }
}
