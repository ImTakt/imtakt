#!/usr/bin/env node
import { createImTakt, createAgentHarness, ImTaktAmbiguousPlaceError } from "@imtakt/sdk"
import { parseDurationMinutes, resolveBaseUrl } from "@imtakt/core"
import type { FareProfile, FormatKind, FormatVerbosity, JourneyView, PlaceRef } from "@imtakt/core"
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
  find <place>                         Resolve a place (stop / station)
  plan <from> <to>                     Time-first options (board or full)
  show <optionId>                      Expand one board option (full plan/v1)
  status <place> | --stop-id <id>      Live / local observation at a place
  follow <runId>                       Follow a train run
  analytics [list|path|use-case]       Optional python3 transforms catalog

Aliases (forward + tip): journey→plan, journey show→show, live→status,
  train→follow, commute→plan with office board defaults.

Output:
  --format json|md|auto   Select ONE channel (default: auto)
  -o <fmt>  --json  --pretty
  auto = markdown on TTY, JSON when piped
  Env: IMTAKT_FORMAT  IMTAKT_SERVER_URL
       IMTAKT_VIEW=board  IMTAKT_FARE=d-ticket  IMTAKT_WINDOW=120m
       IMTAKT_ARRIVE_SLACK=10m

Time (Europe/Berlin local or ISO UTC):
  --at / --when <when>    Depart after (now, +25m, 08:00, ISO)
  --arrive <when>         Arrive by (office / meeting start)
  --leave-by <when>       Latest acceptable departure
  --date YYYY-MM-DD       Compose with HH:MM local times
  --window 120m           Search window (board default 120m)
  --arrive-slack 10m      Soft buffer for arrive-by
  --min-connection 5m     Drop sub-N-minute transfers

Plan options:
  --view board|full       Thin board (default for agents via env) or full cards
  --limit <n>             Board options (default 10)
  --fare d-ticket|regio|any
  --regio, --no-ice       Alias for --fare regio
  --nearby / --exact-stop Cluster nearby stops (Messe Süd/Nord)
  --pack windows|round-trip|day-chain
  --windows "06:00+120m,17:00+120m"
  --return-after <when> --dwell 30m
  --stops "A,B,C"         day-chain
  --from-id / --to-id     Skip name resolve
  --confirm-snap          Fail on fuzzy place snap

Other:
  --limit <n>             find (default 8) · status (default 16, max 30)
  --stop-id <id>          Status by stop id
  --server <url>          API base
  --verbose               Raw API JSON
  -h, --help  -V, --version

Commute recipe (no separate command):
  imtakt plan FROM TO --arrive T --view board --fare d-ticket --nearby \\
    --window 120m --arrive-slack 10m
  Or set IMTAKT_VIEW / IMTAKT_FARE / IMTAKT_WINDOW / IMTAKT_ARRIVE_SLACK.

Anti-pattern: do NOT loop --at every 3–5 minutes. Use --arrive + --window + --view board.
  Flow: plan → show → follow (never poll loops).

Examples:
  imtakt plan "Augsburg Messe" "Gräfelfing, Am Haag" \\
    --arrive 08:00 --date 2026-07-20 --fare d-ticket --nearby --view board --json
  imtakt show opt_0621_re9_xxxxxxxx --json
  imtakt status "Berlin Hbf" --json
  imtakt follow imtakt_run_v1:... --json

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

function parseFare(): FareProfile | undefined {
  const f = flagValue("--fare")
  if (f === "d-ticket" || f === "regio" || f === "any") return f
  if (hasFlag("--regio") || hasFlag("--no-ice")) return "regio"
  return undefined
}

function parseView(defaultView: JourneyView = "full"): JourneyView {
  const v = flagValue("--view") ?? process.env.IMTAKT_VIEW
  if (v === "board" || v === "full") return v
  return defaultView
}

function parseWindowMinutes(): number | undefined {
  const w = flagValue("--window") ?? process.env.IMTAKT_WINDOW
  if (!w) return undefined
  try {
    return parseDurationMinutes(w)
  } catch {
    writeError({ error: `Invalid --window: ${w}`, code: "usage" }, ExitCode.USAGE)
  }
}

function parseSlack(flag: string, envKey?: string): number | undefined {
  const raw = flagValue(flag) ?? (envKey ? process.env[envKey] : undefined)
  if (!raw) return undefined
  try {
    return parseDurationMinutes(raw)
  } catch {
    writeError({ error: `Invalid ${flag}: ${raw}`, code: "usage" }, ExitCode.USAGE)
  }
}

const harness = createAgentHarness(client, {
  excludeLongDistance: hasFlag("--regio") || hasFlag("--no-ice") || parseFare() === "d-ticket",
  minSnapConfidence: hasFlag("--confirm-snap") ? 1 : undefined,
  fare: parseFare(),
  nearby: hasFlag("--nearby") ? true : hasFlag("--exact-stop") ? false : undefined,
  view: parseView(),
  windowMinutes: parseWindowMinutes(),
  arriveSlackMinutes: parseSlack("--arrive-slack", "IMTAKT_ARRIVE_SLACK"),
  departSlackMinutes: parseSlack("--depart-slack"),
  minConnectionMinutes: parseSlack("--min-connection"),
  maxResults: (() => {
    const raw = flagValue("--limit")
    if (raw == null) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? Math.floor(n) : undefined
  })(),
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

function planPrefs() {
  const fare = parseFare()
  return {
    excludeLongDistance: fare === "d-ticket" || fare === "regio" || hasFlag("--regio") || hasFlag("--no-ice"),
    minSnapConfidence: hasFlag("--confirm-snap") ? 1 : undefined,
    fare,
    nearby: hasFlag("--exact-stop") ? false : hasFlag("--nearby") ? true : undefined,
    view: parseView(),
    windowMinutes: parseWindowMinutes(),
    arriveSlackMinutes: parseSlack("--arrive-slack", "IMTAKT_ARRIVE_SLACK"),
    departSlackMinutes: parseSlack("--depart-slack"),
    minConnectionMinutes: parseSlack("--min-connection"),
    maxResults: (() => {
      const raw = flagValue("--limit")
      if (raw == null) return parseView() === "board" ? 10 : undefined
      const n = Number(raw)
      return Number.isFinite(n) ? Math.floor(n) : undefined
    })(),
  }
}

/** One-line alias tip on stderr (aliases still forward). */
function aliasTip(from: string, to: string): void {
  writeWarning(`tip: \`${from}\` is deprecated; use \`${to}\``)
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
  let cmd = args[0]
  if (!cmd || cmd.startsWith("-")) {
    writeError(
      { error: "Usage: imtakt <find|plan|show|status|follow|analytics> ...", code: "usage" },
      ExitCode.USAGE,
    )
  }

  // Thin aliases → five verbs (stderr tip; behavior unchanged).
  if (cmd === "journey" && args[1] === "show") {
    aliasTip("journey show", "show")
    args.splice(0, 2, "show")
    cmd = "show"
  } else if (cmd === "journey") {
    aliasTip("journey", "plan")
    args[0] = "plan"
    cmd = "plan"
  } else if (cmd === "live") {
    aliasTip("live", "status")
    args[0] = "status"
    cmd = "status"
  } else if (cmd === "train") {
    aliasTip("train", "follow")
    args[0] = "follow"
    cmd = "follow"
  } else if (cmd === "commute") {
    aliasTip("commute", "plan … --view board --fare d-ticket (office defaults)")
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
          { error: "Usage: imtakt find <place> [--limit N]", code: "usage" },
          ExitCode.USAGE,
        )
      }
      const data = await client.findStops({ place: query, limit: parseLimit(8) })
      emit(harness, data, "find", format, tty)
      return
    }
    case "commute": {
      // Alias: office board defaults on plan.
      const from = flagValue("--from") ?? flagValue("--from-id")
      const to = flagValue("--to") ?? flagValue("--to-id")
      if (!from || !to) {
        writeError(
          {
            error:
              "Usage: imtakt plan <from> <to> --arrive <when> --view board (alias: commute --from A --to B --arrive T)",
            code: "usage",
          },
          ExitCode.USAGE,
        )
      }
      const fromRef: PlaceRef = hasFlag("--from-id")
        ? { stopId: flagValue("--from-id")! }
        : from!
      const toRef: PlaceRef = hasFlag("--to-id") ? { stopId: flagValue("--to-id")! } : to!
      const arrive = flagValue("--arrive")
      if (!arrive) {
        writeError({ error: "commute alias requires --arrive", code: "usage" }, ExitCode.USAGE)
      }
      try {
        const prefs = planPrefs()
        const result = await harness.plan({
          from: fromRef,
          to: toRef,
          arrive,
          date: flagValue("--date"),
          preferences: {
            ...prefs,
            view: "board",
            nearby: prefs.nearby !== false,
            fare: prefs.fare ?? "d-ticket",
            windowMinutes: prefs.windowMinutes ?? 120,
            arriveSlackMinutes: prefs.arriveSlackMinutes ?? 10,
            maxResults: prefs.maxResults ?? 10,
          },
        })
        if ("pack" in result) {
          writeJson(result.pack, wantPretty(format, tty))
          return
        }
        emit(harness, result, "plan", format, tty, {
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
    case "plan": {
      const pack = flagValue("--pack") as "windows" | "round-trip" | "day-chain" | undefined
      const stopsFlag = flagValue("--stops")
      const stopParts = stopsFlag?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
      const from: PlaceRef =
        pack === "day-chain"
          ? (stopParts[0] ?? placeRef(1, "--from-id"))
          : placeRef(1, "--from-id")
      const to: PlaceRef =
        pack === "day-chain"
          ? (stopParts[stopParts.length - 1] ?? placeRef(2, "--to-id"))
          : placeRef(2, "--to-id")
      if (pack !== "day-chain" && (!to || (typeof to === "string" && to.startsWith("-")))) {
        writeError(
          { error: "Usage: imtakt plan <from> <to> [time/fare/view flags]", code: "usage" },
          ExitCode.USAGE,
        )
      }

      const arrive = flagValue("--arrive")
      const leaveBy = flagValue("--leave-by")
      const at = flagValue("--at") ?? flagValue("--when")
      const departAfter = flagValue("--depart-after")
      const departAfterEvent = flagValue("--depart-after-event")

      try {
        const result = await harness.plan({
          from,
          to,
          when: at,
          arrive,
          leaveBy,
          departAfter,
          departAfterEvent,
          date: flagValue("--date"),
          pack,
          windows: flagValue("--windows"),
          returnAfter: flagValue("--return-after"),
          dwellMinutes: flagValue("--dwell")
            ? parseDurationMinutes(flagValue("--dwell")!)
            : undefined,
          stops: flagValue("--stops"),
          pageCursor: flagValue("--page") === "next" ? flagValue("--cursor") : flagValue("--cursor"),
          preferences: planPrefs(),
        })
        if ("pack" in result) {
          if (format === "md") {
            writeMarkdown("```json\n" + JSON.stringify(result.pack, null, 2) + "\n```")
          } else {
            writeJson(result.pack, wantPretty(format, tty))
          }
          return
        }
        emit(harness, result, "plan", format, tty, {
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
    case "show": {
      const optionId = args[1]
      if (!optionId || optionId.startsWith("-")) {
        writeError({ error: "Usage: imtakt show <optionId>", code: "usage" }, ExitCode.USAGE)
      }
      const result = await harness.show(optionId)
      emit(harness, result, "plan", format, tty, {
        labels: result.labels,
        warnings: result.warnings,
      })
      return
    }
    case "status": {
      const stopId = flagValue("--stop-id")
      const when = flagValue("--when")
      const limit = parseLimit(16, 30)
      if (stopId) {
        const data = await client.stationLive(stopId, {
          limit,
          ...(when ? { when } : {}),
        })
        emit(harness, data, "status", format, tty)
        return
      }
      const place = args[1]
      if (!place || place.startsWith("-")) {
        writeError(
          {
            error: "Usage: imtakt status --stop-id <id> | <place> [--limit N] [--when <iso>]",
            code: "usage",
          },
          ExitCode.USAGE,
        )
      }
      try {
        const data = await harness.status(place, {
          limit,
          ...(when ? { when } : {}),
        })
        if (data.resolved.warning) {
          writeWarning(`> ⚠ ${data.resolved.warning}`)
        }
        emit(harness, data, "status", format, tty)
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
    case "follow": {
      const runId = args[1]
      if (!runId || runId.startsWith("-")) {
        writeError({ error: "Usage: imtakt follow <runId>", code: "usage" }, ExitCode.USAGE)
      }
      const data = await harness.follow(runId)
      emit(harness, data, "follow", format, tty)
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
