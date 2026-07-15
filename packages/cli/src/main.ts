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
import {
  ExitCode,
  FormatError,
  resolveFormat,
  writeError,
  writeJson,
  writeMarkdown,
  writeWarning,
  type OutputFormat,
} from "./output.js"

const VERSION = readPackageVersion()

const HELP = `imtakt — German transit CLI for agents (ImTakt harness)

Usage:
  imtakt <command> [args] [options]

Commands:
  find <query>                         Resolve stops
  journey <from> <to>                  Plan trip (all options + risk facets)
  live <place> | --stop-id <id>        Live departures
  train <runId>                        Train run detail
  analytics [list|path|use-case]       Optional python3 transforms catalog

Output (CLI Spec):
  --format json|md|auto   Select ONE channel (default: auto)
  -o <fmt>                Alias for --format
  --json                  Shorthand for --format json
  --pretty                Indent JSON (handy on TTY)

  auto = markdown on TTY, JSON when piped (agents/scripts)
  stdout = data only · stderr = warnings + {"error","code"} on failure

  Env: IMTAKT_FORMAT=json|md   IMTAKT_SERVER_URL=<url>

Journey options:
  --at <iso>              Departure UTC (default: now)
  --from-id / --to-id     Skip name resolve
  --regio, --no-ice       Exclude ICE/IC/EC
  --confirm-snap          Fail on fuzzy place snap

Other:
  --when <iso>            Live board reference time
  --limit <n>             find (default 8) · live (default 16, max 30)
  --stop-id <id>          Live by stop id
  --server <url>          API base
  --verbose               Raw API JSON (debug; not the agent envelope)
  -h, --help              This help
  -V, --version           {"name","version","harness",...}

Exit codes: 0 ok · 1 usage · 2 api · 3 ambiguous place

Examples:
  imtakt journey "Berlin Hbf" "München Hbf"              # TTY → markdown
  imtakt journey "Berlin Hbf" "München Hbf" | jq .       # pipe → JSON
  imtakt journey "A" "B" --json --pretty
  imtakt find "Gräfelfing" -o md
  imtakt analytics path delay-summary

Docs: https://github.com/ImTakt/imtakt/blob/main/docs/cli.md
`

const args = process.argv.slice(2)

function hasFlag(name: string): boolean {
  return args.includes(name)
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
  if (!Number.isFinite(n) || n < 1) {
    writeError({ error: `Invalid --limit: ${raw}`, code: "usage" }, ExitCode.USAGE)
  }
  if (max != null && n > max) return max
  return Math.floor(n)
}

function verbosity(): FormatVerbosity {
  return hasFlag("--verbose") ? "full" : "compact"
}

function wantPretty(format: OutputFormat, tty: boolean): boolean {
  if (format !== "json") return false
  if (hasFlag("--pretty")) return true
  // Compact one-liner when piped; pretty when human forced --json on TTY
  return tty && hasFlag("--json")
}

function emit(
  harness: ReturnType<typeof createAgentHarness>,
  data: unknown,
  kind: FormatKind,
  format: OutputFormat,
  tty: boolean,
  extra?: { labels?: import("@imtakt/core").RankedJourney[]; warnings?: string[] },
): void {
  const out = harness.format(data, kind, {
    ...extra,
    verbosity: verbosity(),
    presentation: format === "md" ? "markdown" : "json",
  })

  if (format === "json") {
    if (verbosity() === "full") {
      writeJson(JSON.parse(out.json), wantPretty(format, tty))
    } else if (out.payload !== undefined) {
      writeJson(out.payload, wantPretty(format, tty))
    } else {
      writeJson(JSON.parse(out.json), wantPretty(format, tty))
    }
  } else {
    writeMarkdown(out.markdown)
  }

  if (out.stderr) writeWarning(out.stderr)
}

if (hasFlag("--version") || hasFlag("-V")) {
  writeJson(
    {
      name: "@imtakt/cli",
      version: VERSION,
      harness: "@imtakt/sdk",
      analytics: "imtakt analytics",
      output: { default: "auto", channels: ["json", "md"] },
    },
    false,
  )
  process.exit(ExitCode.OK)
}

if (hasFlag("--help") || hasFlag("-h") || args.length === 0) {
  process.stdout.write(HELP)
  process.exit(args.length === 0 ? ExitCode.USAGE : ExitCode.OK)
}

let formatResolved
try {
  formatResolved = resolveFormat(args)
} catch (err) {
  if (err instanceof FormatError) {
    writeError({ error: err.message, code: "format" }, ExitCode.USAGE)
  }
  throw err
}

const { format, tty } = formatResolved

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
  if (!val || val.startsWith("-")) {
    writeError({ error: "Missing place argument", code: "usage" }, ExitCode.USAGE)
  }
  return val
}

function runAnalytics(sub: string | undefined): void {
  const manifest = analyticsManifest()

  if (!sub || sub === "list" || sub === "ls") {
    if (format === "md") {
      writeMarkdown(formatAnalyticsMarkdown(manifest))
      return
    }
    writeJson(manifest, wantPretty(format, tty))
    return
  }

  if (sub === "path") {
    const name = args[2]
    if (!name || name.startsWith("-")) {
      writeError(
        { error: "Usage: imtakt analytics path <script>", code: "usage" },
        ExitCode.USAGE,
      )
    }
    try {
      // Path is a bare string — always plain stdout (pipe-friendly)
      process.stdout.write(analyticsScriptPath(name) + "\n")
    } catch (err) {
      writeError(
        { error: err instanceof Error ? err.message : String(err), code: "usage" },
        ExitCode.USAGE,
      )
    }
    return
  }

  if (sub === "use-case" || sub === "usecase") {
    const id = args[2]
    if (!id || id.startsWith("-")) {
      writeJson(
        { useCases: manifest.useCases.map((u) => u.id) },
        wantPretty(format, tty),
      )
      return
    }
    const uc = getUseCase(id)
    if (!uc) {
      writeError(
        { error: `Unknown use-case: ${id}. Try: imtakt analytics`, code: "usage" },
        ExitCode.USAGE,
      )
    }
    if (format === "md") {
      writeMarkdown(`## ${uc.id} — ${uc.title}\n\n${uc.recipe}\n`)
      return
    }
    writeJson(uc, wantPretty(format, tty))
    return
  }

  if (sub === "--help" || sub === "-h" || sub === "help") {
    writeMarkdown(formatAnalyticsMarkdown(manifest))
    return
  }

  writeError(
    { error: `Unknown analytics subcommand: ${sub}. Try: imtakt analytics`, code: "usage" },
    ExitCode.USAGE,
  )
}

async function main() {
  const cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    writeError(
      { error: "Usage: imtakt <find|journey|live|train|analytics> ...", code: "usage" },
      ExitCode.USAGE,
    )
  }

  if (cmd === "analytics") {
    runAnalytics(args[1])
    return
  }

  switch (cmd) {
    case "find": {
      const query = args[1]
      if (!query || query.startsWith("-")) {
        writeError(
          { error: "Usage: imtakt find <query> [--limit N]", code: "usage" },
          ExitCode.USAGE,
        )
      }
      const data = await client.findStops({ place: query, limit: parseLimit(8) })
      emit(harness, data, "find", format, tty)
      return
    }
    case "journey": {
      const from = placeRef(1, "--from-id")
      const to = placeRef(2, "--to-id")
      if (!to || (typeof to === "string" && to.startsWith("-"))) {
        writeError(
          { error: "Usage: imtakt journey <from> <to> [--at <iso>]", code: "usage" },
          ExitCode.USAGE,
        )
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
        emit(harness, result, "journey", format, tty, {
          labels: result.labels,
          warnings: result.warnings,
        })
      } catch (err) {
        if (err instanceof ImTaktAmbiguousPlaceError) {
          writeError(
            {
              error: err.message,
              code: "ambiguous",
              candidates: err.candidates.map((c) => ({
                id: c.id,
                name: c.name,
                confidence: c.confidence,
              })),
            },
            ExitCode.AMBIGUOUS,
          )
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
        emit(harness, data, "live", format, tty)
        return
      }
      const place = args[1]
      if (!place || place.startsWith("-")) {
        writeError(
          {
            error: "Usage: imtakt live --stop-id <id> | <place> [--limit N] [--when <iso>]",
            code: "usage",
          },
          ExitCode.USAGE,
        )
      }
      try {
        const data = await harness.stationStatus(place, {
          limit,
          ...(when ? { when } : {}),
        })
        if (data.resolved.warning) {
          writeWarning(`> ⚠ ${data.resolved.warning}`)
        }
        emit(harness, data, "live", format, tty)
      } catch (err) {
        if (err instanceof ImTaktAmbiguousPlaceError) {
          writeError(
            {
              error: err.message,
              code: "ambiguous",
              candidates: err.candidates.map((c) => ({
                id: c.id,
                name: c.name,
                confidence: c.confidence,
              })),
            },
            ExitCode.AMBIGUOUS,
          )
        }
        throw err
      }
      return
    }
    case "train": {
      const runId = args[1]
      if (!runId || runId.startsWith("-")) {
        writeError({ error: "Usage: imtakt train <runId>", code: "usage" }, ExitCode.USAGE)
      }
      const data = await harness.viewTrain(runId)
      emit(harness, data, "train", format, tty)
      return
    }
    default:
      writeError({ error: `Unknown command: ${cmd}`, code: "usage" }, ExitCode.USAGE)
  }
}

main().catch((err) => {
  writeError(
    {
      error: err instanceof Error ? err.message : String(err),
      code: "api",
    },
    ExitCode.API,
  )
})
