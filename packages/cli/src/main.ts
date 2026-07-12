#!/usr/bin/env node
import { createImTakt } from "@imtakt/sdk"
import { resolveBaseUrl } from "@imtakt/core"
import { readPackageVersion } from "./version.js"
import { formatHuman } from "./format.js"

const VERSION = readPackageVersion()
const HELP = `imtakt — German transit intelligence CLI

Usage:
  imtakt journey <from> <to> [--at <iso>] [--json] [--server URL]
  imtakt live <station> [--limit N] [--json] [--server URL]
  imtakt track <runId> [--watch <sec>] [--json] [--server URL]
  imtakt board <station> [--json] [--server URL]
  imtakt train <runId> [--json] [--server URL]
  imtakt station <query> [--json] [--server URL]

Options:
  --json          Structured JSON output
  --server URL    API base (default: https://api.imtakt.dev)
  --at <iso>      Departure time for journey (ISO 8601)
  --limit <n>     Departures for live (default 16, max 30)
  --watch <sec>   Poll train track every N seconds until complete

Environment:
  IMTAKT_SERVER_URL   Override API base

Docs: https://github.com/ImTakt/imtakt/blob/main/docs/cli.md
`

const args = process.argv.slice(2)

if (args.includes("--version") || args.includes("-V")) {
  console.log(`@imtakt/cli ${VERSION}`)
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(HELP)
  process.exit(args.length === 0 ? 1 : 0)
}

const json = args.includes("--json")
const serverFlag = args.indexOf("--server")
const baseUrl = resolveBaseUrl(
  serverFlag >= 0 ? args[serverFlag + 1] : undefined,
  process.env.IMTAKT_SERVER_URL,
)

const imtakt = createImTakt({ baseUrl })

function out(data: unknown) {
  console.log(json ? JSON.stringify(data, null, 2) : formatHuman(data))
}

function parseLimit(): number | undefined {
  const idx = args.indexOf("--limit")
  if (idx < 0) return undefined
  const n = Number(args[idx + 1])
  return Number.isFinite(n) ? n : undefined
}

function parseWatchSec(): number {
  const idx = args.indexOf("--watch")
  if (idx < 0) return 0
  const n = Number(args[idx + 1] ?? "30")
  return Number.isFinite(n) && n > 0 ? n : 30
}

async function resolveStationId(station: string): Promise<string> {
  const found = await imtakt.findStops({ place: station, limit: 1 })
  if (!found.matches[0]) throw new Error(`Station not found: ${station}`)
  return found.matches[0].id
}

async function trackTrain(runId: string, watchSec: number) {
  const done = new Set(["completed", "cancelled"])
  for (;;) {
    const data = await imtakt.viewTrain(runId)
    if (!json) {
      console.clear?.()
      out(data)
    } else {
      out(data)
    }
    if (!watchSec || done.has(data.progress.status)) return
    await new Promise((r) => setTimeout(r, watchSec * 1000))
  }
}

async function main() {
  const cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    console.error(`Usage: imtakt <journey|live|track|board|train|station> ...`)
    process.exit(1)
  }

  if (cmd === "journey" || cmd === "plan") {
    const from = args[1]
    const to = args[2]
    if (!from || !to) throw new Error("Usage: imtakt journey <from> <to> [--at <when>]")
    const atIdx = args.indexOf("--at")
    const when = atIdx >= 0 ? args[atIdx + 1] : new Date().toISOString()
    out(await imtakt.planJourney({ from, to, when }))
    return
  }

  if (cmd === "live") {
    const station = args[1]
    if (!station) throw new Error("Usage: imtakt live <station> [--limit N]")
    const stopId = await resolveStationId(station)
    out(await imtakt.stationLive(stopId, { limit: parseLimit() }))
    return
  }

  if (cmd === "track" || cmd === "train") {
    const runId = args[1]
    if (!runId) throw new Error("Usage: imtakt track <runId> [--watch <sec>]")
    const watchSec = cmd === "track" ? parseWatchSec() : 0
    await trackTrain(runId, watchSec)
    return
  }

  if (cmd === "board" || cmd === "view") {
    const station = args[1]
    if (!station) throw new Error("Usage: imtakt board <station>")
    const stopId = await resolveStationId(station)
    out(await imtakt.stationLive(stopId, { limit: 8 }))
    return
  }

  if (cmd === "station" || cmd === "find") {
    const query = args[1]
    if (!query) throw new Error("Usage: imtakt station <query>")
    out(await imtakt.findStops({ place: query }))
    return
  }

  throw new Error(`Unknown command: ${cmd}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
