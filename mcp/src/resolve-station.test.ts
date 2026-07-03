import { describe, expect, test } from "bun:test"
import { resolveStopId } from "./resolve-station.js"
import type { ImTaktClient } from "@imtakt/sdk"

function mockClient(overrides: Partial<ImTaktClient>): ImTaktClient {
  return {
    findStops: async () => ({ matches: [] }),
    planJourney: async () => ({ journeys: [] }),
    stationBoard: async () => ({ stop: { id: "x", name: "x", location: { lat: 0, lng: 0 } }, departures: [] }),
    viewTrain: async () => ({
      runId: "r",
      line: { name: "ICE 1", mode: "rail" },
      direction: "München",
      serviceDate: "2026-07-03",
      stops: [],
      currentDelayMinutes: 0,
      cancelled: false,
    }),
    ...overrides,
  }
}

describe("resolveStopId", () => {
  test("uses stopId directly", async () => {
    const id = await resolveStopId(mockClient({}), { stopId: "de_123" })
    expect(id).toBe("de_123")
  })

  test("resolves place name via findStops", async () => {
    const id = await resolveStopId(
      mockClient({
        findStops: async () => ({
          matches: [{ id: "de_99", name: "Hbf", location: { lat: 1, lng: 2 }, confidence: 1, matchType: "exact" }],
        }),
      }),
      "Berlin Hbf",
    )
    expect(id).toBe("de_99")
  })

  test("throws when place not found", async () => {
    await expect(resolveStopId(mockClient({}), "Nowhere")).rejects.toThrow("Station not found")
  })
})
