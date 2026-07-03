/** Thrown when ImTakt Server returns a non-2xx response. */
export class ImTaktApiError extends Error {
  readonly name = "ImTaktApiError"

  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
    readonly body?: unknown,
  ) {
    super(message)
  }
}

/** Thrown when a response body does not match the expected contract. */
export class ImTaktValidationError extends Error {
  readonly name = "ImTaktValidationError"

  constructor(
    readonly path: string,
    readonly issues: string,
  ) {
    super(`ImTakt API ${path}: invalid response shape — ${issues}`)
  }
}

type ApiErrorBody = { error?: string }

export async function readApiError(res: Response, path: string): Promise<ImTaktApiError> {
  let body: unknown
  let message = `ImTakt API ${path}: ${res.status}`

  try {
    body = await res.json()
    const err = body as ApiErrorBody
    if (typeof err?.error === "string" && err.error.length > 0) {
      message = `ImTakt API ${path}: ${err.error}`
    }
  } catch {
    // non-JSON error body — keep status-only message
  }

  return new ImTaktApiError(res.status, path, message, body)
}
