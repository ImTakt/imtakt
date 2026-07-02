import type { Context, Next } from "hono"
import { config } from "../config"

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientKey(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || c.req.header("x-real-ip") || "local"
}

/** Lightweight in-memory rate limit for hosted API (per client IP). */
export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (config.rateLimitRpm <= 0 || c.req.path === "/health") {
    await next()
    return
  }

  const key = clientKey(c)
  const now = Date.now()
  const windowMs = 60_000
  let bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  c.header("X-RateLimit-Limit", String(config.rateLimitRpm))
  c.header("X-RateLimit-Remaining", String(Math.max(0, config.rateLimitRpm - bucket.count)))

  if (bucket.count > config.rateLimitRpm) {
    c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)))
    return c.json({ error: "Rate limit exceeded. Try again shortly." }, 429)
  }

  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }

  await next()
}
