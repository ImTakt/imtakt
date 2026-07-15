#!/usr/bin/env node
import { createImTakt, createAgentHarness, ImTaktAmbiguousPlaceError } from "@imtakt/sdk"
import { resolveBaseUrl } from "@imtakt/core"
import type { FormatKind, FormatVerbosity, PlaceRef } from "@imtakt/core"
import { readPackageVersion } from "./version.js"
import {
  analyticsManifest,
  analyticsScriptPath,
  formatAnalyticsMarkdown,
  getUseCase,
} from "./analytics.js"

const VERSION = readPackageVersion()
const HELP = `imtakt — agent CLI for ImTakt Server (uses @imtakt/sdk harness)

Commands:
  find <query> [--limit N]
  journey <from> <to> [--at <iso>]
  live --stop-id <id> | <place> [--limit N] [--when <iso>]
  train <runId>
  analytics [list|path <script>|use-case <id>]   Optional transforms (instant catalog)

Harness compact JSON already includes per-option facets (risk, delays, transfers).
Optional python3 pipe (warnings on stderr — use 2>/dev/null):
  imtakt analytics                                    # catalog + use cases (JSON when piped)
  imtakt analytics use-case compare_time_windows
  imtakt journey "A" "B" --format json 2>/dev/null | python3 "$(imtakt analytics path delay-summary)"

Options:
  --server URL       API base (default: https://api.imtakt.dev)
  --at <iso>         Journey departure (ISO 8601 UTC; default: now)
  --when <iso>       Live board reference time (ISO 8601 UTC)
  --limit <n>        find: matches (default 8). live: departures (default 16, max 30)
  --stop-id <id>     Stop id for live (from find output)
  --from-id <id>     Journey origin stop id (skip name resolve)
  --to-id <id>       Journey destination stop id
  --regio, --no-ice  Exclude ICE/IC/EC long-distance legs
  --confirm-snap     Fail when place snap is fuzzy or low-confidence
  --format <fmt>     json | md | both (default: md on TTY, json when piped)
  --verbose          Full JSON + markdown (includes runIds, inline warnings)

Environment:
  IMTAKT_SERVER_URL

Stdout: JSON or markdown per --format. Warnings on stderr.
Docs: https://github.com/ImTakt/imtakt/blob/main/docs/agent-harness.md
`

const args = process.argv.slice(2)

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }))
  process.exit(1)
}

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx < 0) return undefined
  return args[idx + 1]
}

function hasFlag(name: string): boolean {
  return args.includes(name)
}

function parseLimit(defaultValue: number, max?: number): number {
  const raw = flagValue("--limit")
  if (raw === undefined) return defaultValue
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) fail(`Invalid --limit: ${raw}`)
  if (max != null && n > max) return max
  return Math.floor(n)
}

type OutputFormat = "json" | "md" | "both"

function defaultFormat(): OutputFormat {
  const explicit = flagValue("--format") as OutputFormat | undefined
  if (explicit === "json" || explicit === "md" || explicit === "both") return explicit
  return process.stdout.isTTY ? "md" : "json"
}

function verbosity(): FormatVerbosity {
  return hasFlag("--verbose") ? "full" : "compact"
}

function emit(
  harness: ReturnType<typeof createAgentHarness>,
  data: unknown,
  kind: FormatKind,
  format: OutputFormat,
  extra?: { labels?: import("@imtakt/core").RankedJourney[]; warnings?: string[] },
): void {
  const out = harness.format(data, kind, { ...extra, verbosity: verbosity() })
  if (format === "json" || format === "both") {
    console.log(out.json ?? JSON.stringify(data))
  } else if (out.markdown) {
    console.log(out.markdown.trimEnd())
  }
  if (out.stderr) process.stderr.write(out.stderr)
}

if (hasFlag("--version") || hasFlag("-V")) {
  console.log(
    JSON.stringify({
      name: "@imtakt/cli",
      version: VERSION,
      harness: "@imtakt/sdk",
      analytics: "imtakt analytics",
    }),
  )
  process.exit(0)
}

if (hasFlag("--help") || hasFlag("-h") || args.length === 0) {
  console.log(HELP)
  process.exit(args.length === 0 ? 1 : 0)
}

const serverFlag = args.indexOf("--server")
const baseUrl = resolveBaseUrl(
  serverFlag >= 0 ? args[serverFlag + 1] : undefined,
  process.env.IMTAKT_SERVER_URL,
)

const client = createImTakt({ baseUrl })
const harness = createAgentHarness(client, {
  excludeLongDistance: hasFlag("--regio") || hasFlag("--no-ice"),
  minSnapConfidence: hasFlag("--confirm-snap") ? 1 : undefined,
})

function placeRef(cmdIndex: number, idFlag: "--from-id" | "--to-id"): PlaceRef {
  const id = flagValue(idFlag)
  if (id) return { stopId: id }
  const val = args[cmdIndex]
  if (!val || val.startsWith("-")) fail(`Missing place argument`)
  return val
}

function runAnalytics(sub: string | undefined): void {
  const manifest = analyticsManifest()

  if (!sub || sub === "list" || sub === "ls") {
    if (process.stdout.isTTY && !hasFlag("--format")) {
      console.log(formatAnalyticsMarkdown(manifest))
      return
    }
    console.log(JSON.stringify(manifest))
    return
  }

  if (sub === "path") {
    const name = args[2]
    if (!name || name.startsWith("-")) {
      fail("Usage: imtakt analytics path <script>")
    }
    try {
      console.log(analyticsScriptPath(name))
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
    }
    return
  }

  if (sub === "use-case" || sub === "usecase") {
    const id = args[2]
    if (!id || id.startsWith("-")) {
      console.log(JSON.stringify({ useCases: manifest.useCases.map((u) => u.id) }))
      return
    }
    const uc = getUseCase(id)
    if (!uc) fail(`Unknown use-case: ${id}. Try: imtakt analytics`)
    if (process.stdout.isTTY && !hasFlag("--format")) {
      console.log(`## ${uc.id} — ${uc.title}\n\n${uc.recipe}\n`)
      return
    }
    console.log(JSON.stringify(uc))
    return
  }

  if (sub === "--help" || sub === "-h" || sub === "help") {
    console.log(formatAnalyticsMarkdown(manifest))
    return
  }

  fail(`Unknown analytics subcommand: ${sub}. Try: imtakt analytics`)
}

async function main() {
  const cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    fail("Usage: imtakt <find|journey|live|train|analytics> ...")
  }

  if (cmd === "analytics") {
    runAnalytics(args[1])
    return
  }

  const format = defaultFormat()

  switch (cmd) {
    case "find": {
      const query = args[1]
      if (!query || query.startsWith("-")) fail("Usage: imtakt find <query> [--limit N]")
      const data = await client.findStops({ place: query, limit: parseLimit(8) })
      emit(harness, data, "find", format)
      return
    }
    case "journey": {
      const from = placeRef(1, "--from-id")
      const to = placeRef(2, "--to-id")
      if (!to || (typeof to === "string" && to.startsWith("-"))) {
        fail("Usage: imtakt journey <from> <to> [--at <iso>]")
      }
      const when = flagValue("--at") ?? new Date().toISOString()
      try {
        const result = await harness.planTrip({
          from,
          to,
          when,
          preferences: {
            excludeLongDistance: hasFlag("--regio") || hasFlag("--no-ice"),
            minSnapConfidence: hasFlag("--confirm-snap") ? 1 : undefined,
          },
        })
        emit(harness, result, "journey", format, {
          labels: result.labels,
          warnings: result.warnings,
        })
      } catch (err) {
        if (err instanceof ImTaktAmbiguousPlaceError) {
          process.stderr.write(
            harness.format(
              { matches: err.candidates },
              "find",
            ).markdown ?? "",
          )
          fail(err.message)
        }
        throw err
      }
      return
    }
    case "live": {
      const stopId = flagValue("--stop-id")
      const when = flagValue("--when")
      const limit = parseLimit(16, 30)
      if (stopId) {
        const data = await client.stationLive(stopId, {
          limit,
          ...(when ? { when } : {}),
        })
        emit(harness, data, "live", format)
        return
      }
      const place = args[1]
      if (!place || place.startsWith("-")) {
        fail("Usage: imtakt live --stop-id <id> | <place> [--limit N] [--when <iso>]")
      }
      const data = await harness.stationStatus(place, {
        limit,
        ...(when ? { when } : {}),
      })
      if (data.resolved.warning) {
        process.stderr.write(`> ⚠ ${data.resolved.warning}\n`)
      }
      emit(harness, data, "live", format)
      return
    }
    case "train": {
      const runId = args[1]
      if (!runId || runId.startsWith("-")) fail("Usage: imtakt train <runId>")
      const data = await client.viewTrain(runId)
      emit(harness, data, "train", format)
      return
    }
    default:
      fail(`Unknown command: ${cmd}`)
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err))
})
