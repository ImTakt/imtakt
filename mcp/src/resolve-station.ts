import type { ImTaktClient } from "@imtakt/sdk"
import type { PlaceRef } from "@imtakt/core"
import { createAgentHarness } from "@imtakt/sdk"

/** @deprecated Use createAgentHarness(client).find */
export async function resolveStopId(client: ImTaktClient, station: PlaceRef): Promise<string> {
  const harness = createAgentHarness(client)
  const resolved = await harness.find(station)
  return resolved.stopId
}
