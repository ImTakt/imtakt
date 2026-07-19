/**
 * Time grounding for journey search — Europe/Berlin local for humans/agents,
 * ISO 8601 UTC on the wire.
 */
import { AGENT_TZ } from "./bahn-format.js"

export type TimeIntent =
  | "departAfter"
  | "arriveBy"
  | "leaveBy"
  | "windowPack"
  | "eventEnd"

export type TripTimeMeta = {
  intent: TimeIntent
  anchorUtc: string
  anchorLocal: string
  tz: typeof AGENT_TZ
  windowMinutes?: number
  arriveSlackMinutes?: number
  departSlackMinutes?: number
  serviceDate: string
  leaveByUtc?: string
  pageCursor?: string
}

/** UTC offset of Europe/Berlin at a given instant, in minutes (CET=60, CEST=120). */
export function berlinOffsetMinutes(at: Date): number {
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }))
  const berlin = new Date(at.toLocaleString("en-US", { timeZone: AGENT_TZ }))
  return Math.round((berlin.getTime() - utc.getTime()) / 60_000)
}

/** Berlin calendar date YYYY-MM-DD for an instant (avoids UTC midnight slice bugs). */
export function serviceDateBerlin(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  return y && m && day ? `${y}-${m}-${day}` : ""
}

/** Berlin local datetime "YYYY-MM-DD HH:MM". */
export function formatBerlinDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const date = serviceDateBerlin(d)
  const hm = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AGENT_TZ,
  })
  return `${date} ${hm}`
}

/**
 * Parse duration strings like "10m", "120m", "2h", "90min" → minutes.
 */
export function parseDurationMinutes(input: string): number {
  const raw = input.trim().toLowerCase()
  const m = raw.match(/^(\d+)\s*(m|min|mins|h|hr|hrs)?$/)
  if (!m) throw new Error(`Cannot parse duration: "${input}" (use 10m, 120m, 2h)`)
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid duration: "${input}"`)
  if (m[2]?.startsWith("h")) return n * 60
  return n
}

/**
 * Compose Berlin local date (YYYY-MM-DD) + time (HH:MM) → UTC ISO.
 */
export function composeBerlinLocal(dateYmd: string, hm: string): string {
  const dm = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const tm = hm.match(/^(\d{1,2}):(\d{2})$/)
  if (!dm || !tm) {
    throw new Error(`Cannot compose Berlin local from date=${dateYmd} time=${hm}`)
  }
  const naive = new Date(
    Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2])),
  )
  const offset = berlinOffsetMinutes(naive)
  return new Date(naive.getTime() - offset * 60_000).toISOString()
}

/**
 * Resolve a user-friendly "when" into ISO 8601 UTC.
 *
 *   undefined | "" | "now"  → now
 *   "+25m" / "-10m" / "+2h" → relative to now
 *   "14:30"                 → that Berlin wall-clock on `date` or today (tomorrow if past)
 *   "03.07.2026 14:30"      → Berlin local
 *   "2026-07-03 14:30"      → Berlin local
 *   ISO 8601                → passed through
 */
export function resolveWhen(
  input?: string,
  opts?: { now?: Date; date?: string },
): string {
  const now = opts?.now ?? new Date()
  const raw = (input ?? "").trim()
  if (!raw || raw.toLowerCase() === "now") return now.toISOString()

  const rel = raw.match(/^([+-])(\d+)\s*(m|min|h)$/i)
  if (rel) {
    const sign = rel[1] === "-" ? -1 : 1
    const n = Number(rel[2])
    const ms = /h/i.test(rel[3]!) ? n * 3_600_000 : n * 60_000
    return new Date(now.getTime() + sign * ms).toISOString()
  }

  const hm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) {
    if (opts?.date) return composeBerlinLocal(opts.date, `${Number(hm[1])}:${hm[2]}`)
    const offset = berlinOffsetMinutes(now)
    const berlinNow = new Date(now.getTime() + offset * 60_000)
    const candidate = new Date(berlinNow)
    candidate.setUTCHours(Number(hm[1]), Number(hm[2]), 0, 0)
    if (candidate.getTime() < berlinNow.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1)
    }
    return new Date(candidate.getTime() - offset * 60_000).toISOString()
  }

  const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{1,2}):(\d{2})$/)
  if (dmy) {
    const naive = new Date(
      Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4]), Number(dmy[5])),
    )
    const offset = berlinOffsetMinutes(naive)
    return new Date(naive.getTime() - offset * 60_000).toISOString()
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/)
  if (ymd) {
    return composeBerlinLocal(
      `${ymd[1]}-${ymd[2]}-${ymd[3]}`,
      `${Number(ymd[4])}:${ymd[5]}`,
    )
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Cannot parse when: "${raw}" (use now, +25m, 14:30, 03.07.2026 14:30, or ISO 8601)`,
    )
  }
  return parsed.toISOString()
}

export function buildTripTimeMeta(args: {
  intent: TimeIntent
  anchorUtc: string
  windowMinutes?: number
  arriveSlackMinutes?: number
  departSlackMinutes?: number
  leaveByUtc?: string
  pageCursor?: string
}): TripTimeMeta {
  const meta: TripTimeMeta = {
    intent: args.intent,
    anchorUtc: args.anchorUtc,
    anchorLocal: formatBerlinDateTimeLocal(args.anchorUtc),
    tz: AGENT_TZ,
    serviceDate: serviceDateBerlin(args.anchorUtc),
  }
  if (args.windowMinutes != null) meta.windowMinutes = args.windowMinutes
  if (args.arriveSlackMinutes != null) meta.arriveSlackMinutes = args.arriveSlackMinutes
  if (args.departSlackMinutes != null) meta.departSlackMinutes = args.departSlackMinutes
  if (args.leaveByUtc) meta.leaveByUtc = args.leaveByUtc
  if (args.pageCursor) meta.pageCursor = args.pageCursor
  return meta
}

/** Stable option id from depart/arrive/lines. */
export function optionIdFromJourney(args: {
  depart: string
  arrive: string
  lines: string[]
}): string {
  const key = `${args.depart}|${args.arrive}|${args.lines.join(",")}`
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  const hex = (h >>> 0).toString(16).padStart(8, "0")
  const depHm = args.depart.slice(11, 16).replace(":", "") || "xxxx"
  const lineSlug = (args.lines[0] ?? "x")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8)
  return `opt_${depHm}_${lineSlug}_${hex}`
}
