import { app } from "./app"
import { config } from "./config"
import { meiliClient, routerClient } from "./lib/http-client"
import { pingDb } from "./services/stops-db"

async function warmConnections(): Promise<void> {
  const tasks: Promise<unknown>[] = [
    meiliClient.getJson("/health").catch(() => null),
    routerClient.getJson("/api/v6/status").catch(() => null),
  ]
  if (config.databaseUrl) tasks.push(pingDb())
  await Promise.allSettled(tasks)
}

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 255,
  maxRequestBodySize: config.maxRequestBodyBytes,
  development: !config.isProduction,
  reusePort: config.reusePort,
})

console.log(`ImTakt Server (Bun ${Bun.version}) → http://localhost:${server.port}`)

void warmConnections().then(() => {
  if (!config.isProduction) console.log("Upstream connections warmed")
})

if (config.warmIntervalSec > 0) {
  setInterval(() => {
    void warmConnections()
  }, config.warmIntervalSec * 1000).unref()
}

export { server }
