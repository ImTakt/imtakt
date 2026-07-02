import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { Context, Next } from "hono"
import { config } from "../config"

let db: Database | null = null

function getDb(): Database {
  if (!db) {
    mkdirSync(dirname(config.archivePath), { recursive: true })
    db = new Database(config.archivePath, { create: true })
    db.run(`
      CREATE TABLE IF NOT EXISTS api_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        method TEXT NOT NULL,
        request_body TEXT,
        response_body TEXT NOT NULL,
        status INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }
  return db
}

/** G2: append-only archive when IMTAKT_ARCHIVE=1 */
export async function archiveMiddleware(c: Context, next: Next) {
  if (!config.archiveEnabled) {
    await next()
    return
  }

  const path = c.req.path
  const method = c.req.method
  let requestBody: string | null = null
  if (method === "POST") {
    try {
      requestBody = await c.req.raw.clone().text()
    } catch {
      requestBody = null
    }
  }

  await next()

  try {
    const responseBody = await c.res.clone().text()
    getDb().run(
      `INSERT INTO api_responses (path, method, request_body, response_body, status) VALUES (?, ?, ?, ?, ?)`,
      [path, method, requestBody, responseBody, c.res.status],
    )
  } catch (err) {
    console.error("Archive write failed:", err)
  }
}
