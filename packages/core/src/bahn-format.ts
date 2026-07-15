/** Shared Europe/Berlin presentation helpers — DB Navigator–style agent context. */

export const AGENT_TZ = "Europe/Berlin"

/** HH:MM in Europe/Berlin (de-DE). */
export function localHm(iso: string, timeZone: string = AGENT_TZ): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })
}

/** DB-style duration: "45 Min" / "1 Std 33 Min". */
export function durationTextDe(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "?"
  const m = Math.round(minutes)
  if (m < 60) return `${m} Min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} Std` : `${h} Std ${rest} Min`
}

/** Umstieg label: "Direkt" / "1 Umstieg" / "2 Umstiege". */
export function changesTextDe(transfers: number): string {
  if (transfers <= 0) return "Direkt"
  if (transfers === 1) return "1 Umstieg"
  return `${transfers} Umstiege`
}

/**
 * Coarse product family from line name — how DB cards group modes.
 * Not a substitute for `mode` from the API.
 */
export function productFamily(lineName: string): string {
  const n = lineName.trim().toUpperCase()
  if (!n) return "other"
  if (n.startsWith("ICE")) return "ICE"
  if (n.startsWith("IC ") || n === "IC" || n.startsWith("EC ") || n.startsWith("ECE")) return "IC"
  if (n.startsWith("RJ") || n.startsWith("RJX")) return "RJ"
  if (n.startsWith("RE")) return "RE"
  if (n.startsWith("RB") || n.startsWith("IRE")) return "RB"
  if (n.startsWith("S ") || /^S\d/.test(n) || n.startsWith("S-")) return "S"
  if (n.startsWith("U ") || /^U\d/.test(n)) return "U"
  if (n.startsWith("STR") || n.includes("TRAM")) return "Tram"
  if (n.startsWith("BUS") || n.startsWith("Bus")) return "Bus"
  if (/fu[ss]weg|walk/i.test(lineName)) return "Walk"
  return "other"
}

/** Connection card headline — primary agent scan line (DB list-row style). */
export function connectionHeadline(args: {
  departIso: string
  arriveIso: string
  durationMinutes: number
  transfers: number
  products: string[]
  timeZone?: string
}): string {
  const tz = args.timeZone ?? AGENT_TZ
  const dep = localHm(args.departIso, tz)
  const arr = localHm(args.arriveIso, tz)
  const dur = durationTextDe(args.durationMinutes)
  const ch = changesTextDe(args.transfers)
  const prod = args.products.slice(0, 4).join(", ")
  const base = `${dep}→${arr} · ${dur} · ${ch}`
  return prod ? `${base} · ${prod}` : base
}
