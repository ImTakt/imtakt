import { describe, expect, test } from "bun:test"
import { createImTakt } from "./index.js"
import { ImTaktApiError, ImTaktValidationError } from "./errors.js"

const BASE = "https://api.imtakt.dev"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("createImTakt", () => {
  test("findStops validates request before fetch", async () => {
    let called = false
    const client = createImTakt({
      baseUrl: BASE,
      fetch: async () => {
        called = true
        return jsonResponse({ matches: [] })
      },
    })
    await expect(client.findStops({} as never)).rejects.toThrow()
    expect(called).toBe(false)
  })

  test("findStops parses successful response", async () => {
    const client = createImTakt({
      baseUrl: BASE,
      fetch: async () =>
        jsonResponse({
          matches: [
            {
              id: "de_1",
              name: "Berlin Hbf",
              location: { lat: 52.5, lng: 13.3 },
              confidence: 1,
              matchType: "exact",
            },
          ],
        }),
    })
    const result = await client.findStops({ place: "Berlin Hbf" })
    expect(result.matches[0]?.name).toBe("Berlin Hbf")
  })

  test("surfaces API error message from JSON body", async () => {
    const client = createImTakt({
      baseUrl: BASE,
      fetch: async () => jsonResponse({ error: "Invalid input" }, 400),
    })
    await expect(client.planJourney({ from: "a", to: "b", when: "2026-07-03T10:00:00Z" })).rejects.toMatchObject({
      name: "ImTaktApiError",
      status: 400,
      message: "ImTakt API /v1/journeys/plan: Invalid input",
    } satisfies Partial<ImTaktApiError>)
  })

  test("throws validation error on malformed response", async () => {
    const client = createImTakt({
      baseUrl: BASE,
      fetch: async () => jsonResponse({ not: "matches" }),
    })
    await expect(client.findStops({ place: "Berlin" })).rejects.toBeInstanceOf(ImTaktValidationError)
  })

  test("times out slow requests", async () => {
    const client = createImTakt({
      baseUrl: BASE,
      timeoutMs: 30,
      fetch: (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted")
            err.name = "AbortError"
            reject(err)
          })
        }),
    })
    await expect(client.findStops({ place: "Berlin" })).rejects.toThrow("timed out")
  })
})
