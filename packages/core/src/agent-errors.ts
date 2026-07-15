import type { StopMatch } from "./schemas.js"

/** Shape matching API 422 ambiguous_place responses. */
export type AmbiguousPlaceErrorBody = {
  error: "ambiguous_place"
  field: "from" | "to"
  message: string
  candidates: StopMatch[]
}

export function isAmbiguousPlaceErrorBody(body: unknown): body is AmbiguousPlaceErrorBody {
  return (
    typeof body === "object" &&
    body != null &&
    (body as AmbiguousPlaceErrorBody).error === "ambiguous_place" &&
    Array.isArray((body as AmbiguousPlaceErrorBody).candidates)
  )
}
