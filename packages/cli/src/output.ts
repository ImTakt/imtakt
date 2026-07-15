/**
 * CLI output selection — CLI Spec / agent-CLI conventions:
 * - Explicit `--format` / `-o` / `--json` always wins
 * - Else `IMTAKT_FORMAT` if set
 * - Else auto: TTY → markdown (human), pipe → json (machine)
 * - stdout = data only; stderr = warnings + structured errors
 */

export type OutputFormat = "json" | "md"

export type FormatSource = "flag" | "env" | "auto"

export type ResolvedFormat = {
  format: OutputFormat
  source: FormatSource
  /** true when stdout is a TTY (human session). */
  tty: boolean
}

export function resolveFormat(args: string[]): ResolvedFormat {
  const tty = process.stdout.isTTY === true

  if (args.includes("--json")) {
    return { format: "json", source: "flag", tty }
  }

  const fromFlag = flagValue(args, "--format") ?? flagValue(args, "-o")
  if (fromFlag != null) {
    const normalized = normalizeFormat(fromFlag)
    if (!normalized) {
      throw new FormatError(
        `Invalid --format '${fromFlag}'. Use: json | md | markdown | auto`,
      )
    }
    if (normalized === "auto") {
      return { format: tty ? "md" : "json", source: "auto", tty }
    }
    return { format: normalized, source: "flag", tty }
  }

  const fromEnv = process.env.IMTAKT_FORMAT?.trim()
  if (fromEnv) {
    const normalized = normalizeFormat(fromEnv)
    if (!normalized || normalized === "auto") {
      throw new FormatError(
        `Invalid IMTAKT_FORMAT='${fromEnv}'. Use: json | md | markdown`,
      )
    }
    return { format: normalized, source: "env", tty }
  }

  return { format: tty ? "md" : "json", source: "auto", tty }
}

function normalizeFormat(raw: string): OutputFormat | "auto" | null {
  const v = raw.trim().toLowerCase()
  if (v === "json") return "json"
  if (v === "md" || v === "markdown" || v === "text") return "md"
  if (v === "auto") return "auto"
  // Removed: "both" — pick one channel (token + pipe hygiene)
  return null
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx < 0) return undefined
  return args[idx + 1]
}

export class FormatError extends Error {
  readonly name = "FormatError"
}

/** Exit codes — stable for agents/scripts. */
export const ExitCode = {
  OK: 0,
  USAGE: 1,
  API: 2,
  AMBIGUOUS: 3,
} as const

export type ErrorBody = {
  error: string
  code: "usage" | "api" | "ambiguous" | "format"
  candidates?: Array<{ id: string; name: string; confidence?: number }>
}

export function writeError(body: ErrorBody, exit: number): never {
  process.stderr.write(JSON.stringify(body) + "\n")
  process.exit(exit)
}

export function writeJson(data: unknown, pretty: boolean): void {
  process.stdout.write(
    (pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + "\n",
  )
}

export function writeMarkdown(md: string): void {
  process.stdout.write(md.trimEnd() + "\n")
}

export function writeWarning(text: string): void {
  process.stderr.write(text.endsWith("\n") ? text : text + "\n")
}
