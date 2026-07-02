import { ZodError } from "zod"

const INTERNAL_PATTERN =
  /meilisearch|meili\b|motis|\/api\/v6\/|routing request failed|stats \d+/i

export function validationErrorResponse(err: ZodError): { error: string; status: 400 } {
  const first = err.issues[0]?.message ?? "Invalid request"
  return { error: first, status: 400 }
}

/** Never leak bootstrap stack names or upstream bodies to /v1 clients. */
export function publicErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? "Invalid request"
  if (err instanceof Error && !INTERNAL_PATTERN.test(err.message)) return err.message
  return fallback
}
