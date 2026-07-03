/** MCP tool result helpers — keep stdout JSON-RPC clean; errors use isError. */

export function toolJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
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
