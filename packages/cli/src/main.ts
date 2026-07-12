#!/usr/bin/env node
import { createImTakt } from "@imtakt/sdk"
import { resolveBaseUrl } from "@imtakt/core"
import { readPackageVersion } from "./version.js"

const VERSION = readPackageVersion()
const HELP = `imtakt — agent CLI for ImTakt Server (JSON stdout)

Commands:
  find <query> [--limit N]
  journey <from> <to> [--at <iso>]
  live --stop-id <id> [--limit N] [--when <iso>]
  train <runId>

Options:
  --server URL     API base (default: https://api.imtakt.dev)
  --at <iso>       Journey departure (ISO 8601 UTC; default: now)
  --when <iso>     Live board reference time (ISO 8601 UTC)
  --limit <n>      find: match count (default 8). live: departures (default 16, max 30)
  --stop-id <id>   Required for live

Environment:
  IMTAKT_SERVER_URL

Stdout: JSON. Stderr on error: {"error":"..."}
Docs: https://github.com/ImTakt/imtakt/blob/main/docs/cli.md
`

const args = process.argv.slice(2)

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }))
  process.exit(1)
}

function out(data: unknown) {
  console.log(JSON.stringify(data))
}

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx < 0) return undefined
  return args[idx + 1]
}

function parseLimit(defaultValue: number, max?: number): number {
  const raw = flagValue("--limit")
  if (raw === undefined) return defaultValue
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) fail(`Invalid --limit: ${raw}`)
  if (max != null && n > max) return max
  return Math.floor(n)
}

if (args.includes("--version") || args.includes("-V")) {
  console.log(JSON.stringify({ name: "@imtakt/cli", version: VERSION }))
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(HELP)
  process.exit(args.length === 0 ? 1 : 0)
}

const serverFlag = args.indexOf("--server")
const baseUrl = resolveBaseUrl(
  serverFlag >= 0 ? args[serverFlag + 1] : undefined,
  process.env.IMTAKT_SERVER_URL,
)

const imtakt = createImTakt({ baseUrl })

async function main() {
  const cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    fail("Usage: imtakt <find|journey|live|train> ...")
  }

  switch (cmd) {
    case "find": {
      const query = args[1]
      if (!query || query.startsWith("-")) fail("Usage: imtakt find <query> [--limit N]")
      out(await imtakt.findStops({ place: query, limit: parseLimit(8) }))
      return
    }
    case "journey": {
      const from = args[1]
      const to = args[2]
      if (!from || !to || from.startsWith("-") || to.startsWith("-")) {
        fail("Usage: imtakt journey <from> <to> [--at <iso>]")
      }
      const when = flagValue("--at") ?? new Date().toISOString()
      out(await imtakt.planJourney({ from, to, when }))
      return
    }
    case "live": {
      const stopId = flagValue("--stop-id")
      if (!stopId) fail("Usage: imtakt live --stop-id <id> [--limit N] [--when <iso>]")
      const when = flagValue("--when")
      out(
        await imtakt.stationLive(stopId, {
          limit: parseLimit(16, 30),
          ...(when ? { when } : {}),
        }),
      )
      return
    }
    case "train": {
      const runId = args[1]
      if (!runId || runId.startsWith("-")) fail("Usage: imtakt train <runId>")
      out(await imtakt.viewTrain(runId))
      return
    }
    default:
      fail(`Unknown command: ${cmd}`)
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err))
})
