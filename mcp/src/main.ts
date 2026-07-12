#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createImTakt } from "@imtakt/sdk"
import { resolveBaseUrl } from "@imtakt/core"
import { readPackageVersion } from "./version.js"
import { registerImTaktTools } from "./register-tools.js"
import { registerImTaktPrompts } from "./register-prompts.js"

const VERSION = readPackageVersion()

const args = process.argv.slice(2)
if (args.includes("--version") || args.includes("-V")) {
  console.log(`@imtakt/mcp ${VERSION}`)
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`@imtakt/mcp ${VERSION} — MCP server for German transit intelligence

Usage:
  npx -y @imtakt/mcp          Start stdio MCP server (default)
  imtakt-mcp --version        Print version

Tools:   imtakt_find_station, imtakt_plan_journey, imtakt_view_station, imtakt_station_live, imtakt_view_train
Prompts: plan_trip, next_departures, round_trip, follow_train
API:     https://api.imtakt.dev (override with IMTAKT_SERVER_URL)

Docs: https://github.com/ImTakt/imtakt/blob/main/docs/mcp.md
`)
  process.exit(0)
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: "imtakt",
    version: VERSION,
  })

  const client = createImTakt({
    baseUrl: resolveBaseUrl(undefined, process.env.IMTAKT_SERVER_URL),
  })

  registerImTaktTools(server, client)
  registerImTaktPrompts(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "ImTakt MCP failed to start")
  process.exit(1)
})
