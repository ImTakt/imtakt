/** MCP tool result helpers — keep stdout JSON-RPC clean; errors use isError. */

export function toolJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

/** Prefer `payload` from harness.format() to avoid redundant JSON round-trips. */
export function toolJsonFromFormat(out: { payload?: unknown; json?: string }) {
  if (out.payload !== undefined) return toolJson(out.payload)
  if (out.json) {
    try {
      return toolJson(JSON.parse(out.json))
    } catch {
      return { content: [{ type: "text" as const, text: out.json }] }
    }
  }
  return toolJson({})
}

/**
 * One channel per call — JSON default (agents); markdown on request.
 * Avoid returning both (token cost); pick with `presentation`.
 */
export function toolFromFormat(
  out: { payload?: unknown; json: string; markdown: string },
  presentation: "json" | "markdown" = "json",
) {
  if (presentation === "markdown") {
    return { content: [{ type: "text" as const, text: out.markdown }] }
  }
  return toolJsonFromFormat(out)
}

export function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  }
}

/** Map SDK/API failures to agent-safe tool errors (no stack traces). */
export function formatToolError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return "ImTakt request failed"
}
