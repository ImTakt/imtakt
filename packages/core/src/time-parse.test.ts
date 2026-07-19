/**
 * Run: bun packages/core/src/time-parse.test.ts
 */
import {
  assessJourneyRisk,
  composeBerlinLocal,
  connectionScoreFromRisk,
  optionIdFromJourney,
  parseDurationMinutes,
  resolveWhen,
  serviceDateBerlin,
  type Journey,
} from "./index.js"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// Duration
assert(parseDurationMinutes("120m") === 120, "120m")
assert(parseDurationMinutes("2h") === 120, "2h")
assert(parseDurationMinutes("10") === 10, "bare minutes")

// Berlin compose (CEST July)
const iso = composeBerlinLocal("2026-07-20", "08:00")
assert(iso === "2026-07-20T06:00:00.000Z", `expected 06:00Z got ${iso}`)
assert(serviceDateBerlin(iso) === "2026-07-20", "serviceDate")

// resolveWhen with date
const r = resolveWhen("08:00", { date: "2026-07-20" })
assert(r === "2026-07-20T06:00:00.000Z", `resolveWhen date+hm ${r}`)

const now = new Date("2026-07-20T10:00:00.000Z")
assert(resolveWhen("+25m", { now }) === "2026-07-20T10:25:00.000Z", "+25m")
assert(resolveWhen("-10m", { now }) === "2026-07-20T09:50:00.000Z", "-10m")

const id = optionIdFromJourney({
  depart: "2026-07-20T04:21:00.000Z",
  arrive: "2026-07-20T05:29:00.000Z",
  lines: ["41", "3", "RE9", "S6"],
})
assert(id.startsWith("opt_"), `optionId ${id}`)

const dummy: Journey = {
  durationMinutes: 60,
  transfers: 1,
  legs: [
    {
      origin: { id: "a", name: "A", location: { lat: 0, lng: 0 } },
      destination: { id: "b", name: "B", location: { lat: 0, lng: 0 } },
      plannedDeparture: "2026-07-20T04:00:00.000Z",
      departure: "2026-07-20T04:00:00.000Z",
      arrival: "2026-07-20T04:30:00.000Z",
      delayMinutes: 0,
      line: { name: "RE9", mode: "rail" },
      cancelled: false,
    },
    {
      origin: { id: "b", name: "B", location: { lat: 0, lng: 0 } },
      destination: { id: "c", name: "C", location: { lat: 0, lng: 0 } },
      plannedDeparture: "2026-07-20T04:40:00.000Z",
      departure: "2026-07-20T04:40:00.000Z",
      arrival: "2026-07-20T05:00:00.000Z",
      delayMinutes: 0,
      line: { name: "S6", mode: "rail" },
      cancelled: false,
    },
  ],
}
const risk = assessJourneyRisk(dummy)
const score = connectionScoreFromRisk(risk)
assert(score >= 0 && score <= 100, `connectionScore ${score}`)

console.log("time-parse tests OK")
