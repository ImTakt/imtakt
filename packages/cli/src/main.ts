#!/usr/bin/env node
import { createImTakt } from "@imtakt/sdk"
import { resolveBaseUrl } from "@imtakt/core"
import { readPackageVersion } from "./version.js"

const VERSION = readPackageVersion()
const HELP = `imtakt — German transit intelligence CLI

Usage:
  imtakt journey <from> <to> [--at <iso>] [--json] [--server URL]
  imtakt board <station> [--json] [--server URL]
  imtakt train <runId> [--json] [--server URL]
  imtakt station <query> [--json] [--server URL]

Options:
  --json          Structured JSON output
  --server URL    API base (default: https://api.imtakt.dev)
  --at <iso>      Departure time for journey (ISO 8601)

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

function formatHuman(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data, null, 2)
}

async function main() {
  const cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    console.error(`Usage: imtakt <journey|board|train|station> ... [--json] [--server URL]`)
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

  if (cmd === "board" || cmd === "view") {
    const station = args[1]
    if (!station) throw new Error("Usage: imtakt board <station>")
    const found = await imtakt.findStops({ place: station, limit: 1 })
    if (!found.matches[0]) throw new Error(`Station not found: ${station}`)
    out(await imtakt.stationBoard(found.matches[0].id))
    return
  }

  if (cmd === "train") {
    const runId = args[1]
    if (!runId) throw new Error("Usage: imtakt train <runId>")
    out(await imtakt.viewTrain(runId))
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
