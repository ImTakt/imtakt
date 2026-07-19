import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Instant catalog (no python3 spawn).
 * `domain: "transit"` today — reserved so a future logistics harness can add
 * domains without breaking discovery.
 */
export const ANALYTICS_CATALOG = [
  {
    name: "delay-summary",
    domain: "transit",
    input: "journey",
    description: "Aggregate delays/cancellations across options",
    stdout: "json",
  },
  {
    name: "filter-regio",
    domain: "transit",
    input: "journey",
    description: "Drop ICE/IC/EC journeys (explicit agent preference filter)",
    stdout: "json",
  },
  {
    name: "flatten-legs",
    domain: "transit",
    input: "journey",
    description: "One row per rail leg (pandas)",
    stdout: "json",
  },
  {
    name: "rank-by-delay",
    domain: "transit",
    input: "journey",
    description: "Reorder options by total delay (same count in/out)",
    stdout: "json",
  },
  {
    name: "to-markdown-report",
    domain: "transit",
    input: "journey",
    description: "Custom markdown report from compact JSON",
    stdout: "json",
  },
  {
    name: "export-csv",
    domain: "transit",
    input: "journey",
    description: "Flatten legs to CSV",
    stdout: "csv",
  },
  {
    name: "merge-journey-searches",
    domain: "transit",
    input: "multi",
    description: "Merge N journey searches into a facet matrix (all options)",
    stdout: "json",
  },
  {
    name: "round-trip-matrix",
    domain: "transit",
    input: "multi",
    description: "All out×return pairs from merge output (agent picks)",
    stdout: "json",
  },
  {
    name: "extract-run-ids",
    domain: "transit",
    input: "journey",
    description: "Extract runIds from journey or live for train drill-down",
    stdout: "json",
  },
  {
    name: "live-delay-summary",
    domain: "transit",
    input: "live",
    description: "Live board delay/cancel facts",
    stdout: "json",
  },
  {
    name: "live-export-csv",
    domain: "transit",
    input: "live",
    description: "Live departures as CSV",
    stdout: "csv",
  },
  {
    name: "train-summary",
    domain: "transit",
    input: "train",
    description: "Train run progress and delay facts",
    stdout: "json",
  },
  {
    name: "flatten-stops",
    domain: "transit",
    input: "train",
    description: "One row per train stop (pandas)",
    stdout: "json",
  },
] as const

export type AnalyticsScriptName = (typeof ANALYTICS_CATALOG)[number]["name"]

const NAMES = new Set<string>(ANALYTICS_CATALOG.map((s) => s.name))

const PIPE_BY_INPUT: Record<string, string> = {
  journey: 'imtakt plan "A" "B" --format json 2>/dev/null | python3 "$(imtakt analytics path <script>)"',
  live: 'imtakt status "Berlin Hbf" --format json 2>/dev/null | python3 "$(imtakt analytics path <script>)"',
  train: 'imtakt follow "$RUN_ID" --format json 2>/dev/null | python3 "$(imtakt analytics path <script>)"',
  multi: 'jq -s \'{searches:[{label:"morning",result:.[0]},{label:"evening",result:.[1]}]}\' s1.json s2.json | python3 "$(imtakt analytics path merge-journey-searches)"',
}

export const USE_CASES = [
  {
    id: "plan_simple",
    domain: "transit",
    title: "Plan A→B — all options with facets (no Python)",
    harnessCalls: 1,
    scripts: [] as string[],
    agentDecides: true,
    recipe:
      'imtakt plan "FROM" "TO" --view board --format json 2>/dev/null\n# Board: options[].connectionScore / arriveSlackMinutes — then imtakt show <optionId>',
  },
  {
    id: "compare_options",
    domain: "transit",
    title: "Compare options using compact facets",
    harnessCalls: 1,
    scripts: [] as string[],
    agentDecides: true,
    recipe:
      'imtakt plan "A" "B" --format json 2>/dev/null | jq \'.journeys[] | {option, tags, durationMinutes, totalDelayMinutes, riskLevel, transferGaps}\'',
  },
  {
    id: "compare_time_windows",
    domain: "transit",
    title: "Compare multiple departure windows",
    harnessCalls: 1,
    scripts: ["merge-journey-searches"],
    agentDecides: true,
    recipe:
      '# Prefer one server pack:\nimtakt plan "A" "B" --pack windows --windows "06:00+120m,17:00+120m" --view board --format json\n# Offline merge (advanced):\nimtakt plan "A" "B" --at "$T1" --format json 2>/dev/null > s1.json\nimtakt plan "A" "B" --at "$T2" --format json 2>/dev/null > s2.json\njq -s \'{searches:[{label:"morning",when:$t1,result:.[0]},{label:"evening",when:$t2,result:.[1]}]}\' --arg t1 "$T1" --arg t2 "$T2" s1.json s2.json | python3 "$(imtakt analytics path merge-journey-searches)"',
  },
  {
    id: "round_trip",
    domain: "transit",
    title: "Round-trip pair matrix (all combinations)",
    harnessCalls: 1,
    scripts: ["merge-journey-searches", "round-trip-matrix"],
    agentDecides: true,
    recipe:
      '# Prefer: imtakt plan A B --pack round-trip --arrive … --return-after … --view board --json\n# Offline merge (advanced):\njq -s \'{searches:[{label:"out",result:.[0]},{label:"return",result:.[1]}]}\' out.json ret.json | python3 "$(imtakt analytics path merge-journey-searches)" | python3 "$(imtakt analytics path round-trip-matrix)"',
  },
  {
    id: "day_of_travel",
    domain: "transit",
    title: "Live board + train drill-down",
    harnessCalls: "1+",
    scripts: ["live-delay-summary", "extract-run-ids", "train-summary"],
    agentDecides: true,
    recipe:
      'imtakt status "Berlin Hbf" --format json 2>/dev/null | python3 "$(imtakt analytics path live-delay-summary)"\nimtakt follow "$RUN_ID" --format json 2>/dev/null | python3 "$(imtakt analytics path train-summary)"',
  },
  {
    id: "monitor_planned_legs",
    domain: "transit",
    title: "Extract runIds from a planned journey",
    harnessCalls: 1,
    scripts: ["extract-run-ids"],
    agentDecides: true,
    recipe:
      'imtakt plan "A" "B" --format json 2>/dev/null | python3 "$(imtakt analytics path extract-run-ids)"',
  },
] as const

/** Directory shipped with @imtakt/cli (`analytics/*.py`). */
export function analyticsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  for (const dir of [join(here, "../analytics"), join(here, "../../analytics")]) {
    if (existsSync(join(dir, "delay-summary.py"))) return dir
  }
  return join(here, "../analytics")
}

export function analyticsScriptPath(name: string): string {
  const base = name.replace(/\.py$/, "")
  if (!NAMES.has(base)) {
    throw new Error(`Unknown analytics script: ${name}. Run: imtakt analytics`)
  }
  return join(analyticsDir(), `${base}.py`)
}

export type AnalyticsManifest = {
  principle: string
  domain: string
  domainsReserved: string[]
  sources: string[]
  pathCommand: string
  patterns: Record<string, string>
  scripts: Array<
    (typeof ANALYTICS_CATALOG)[number] & {
      path: string
      pipe: string
    }
  >
  useCases: Array<(typeof USE_CASES)[number]>
}

export function analyticsManifest(): AnalyticsManifest {
  const dir = analyticsDir()
  return {
    principle:
      "Harness compact JSON includes per-option facets. Analytics enrich further. All viable options preserved. Agent decides.",
    domain: "transit",
    domainsReserved: ["transit", "logistics"],
    sources: ["journey", "live", "train", "multi"],
    pathCommand: "imtakt analytics path <script>",
    patterns: { ...PIPE_BY_INPUT },
    scripts: ANALYTICS_CATALOG.map((s) => ({
      ...s,
      path: join(dir, `${s.name}.py`),
      pipe: (PIPE_BY_INPUT[s.input] ?? PIPE_BY_INPUT.journey!).replace("<script>", s.name),
    })),
    useCases: [...USE_CASES],
  }
}

export function getUseCase(id: string) {
  return USE_CASES.find((u) => u.id === id)
}

export function formatAnalyticsMarkdown(manifest: AnalyticsManifest): string {
  const byInput = new Map<string, typeof manifest.scripts>()
  for (const s of manifest.scripts) {
    const list = byInput.get(s.input) ?? []
    list.push(s)
    byInput.set(s.input, list)
  }
  const lines = [
    "## Analytics (optional python3 pipe)",
    "",
    manifest.principle,
    "",
    `Domain: **${manifest.domain}** (reserved: ${manifest.domainsReserved.join(", ")})`,
    "",
    "Prefer harness compact JSON facets first — Python only for multi-search / live / train transforms.",
    "",
    "### Use cases",
    "",
    ...manifest.useCases.map(
      (u) => `- \`${u.id}\` — ${u.title} → \`imtakt analytics use-case ${u.id}\``,
    ),
    "",
    "### Scripts by input",
    "",
  ]
  for (const [input, scripts] of byInput) {
    lines.push(`#### ${input}`, "")
    lines.push("| Script | Out | Description |")
    lines.push("| --- | --- | --- |")
    for (const s of scripts) {
      lines.push(`| \`${s.name}\` | ${s.stdout} | ${s.description} |`)
    }
    lines.push("")
  }
  lines.push("```bash", 'imtakt analytics path delay-summary', "```")
  return lines.join("\n")
}
