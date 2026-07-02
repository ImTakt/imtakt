/** In-memory TTL cache for hot read paths (health, feed meta). */
export function createTtlCache<T>(ttlMs: number) {
  let entry: { value: T; expires: number } | null = null

  return {
    async get(fetcher: () => Promise<T>): Promise<T> {
      const now = Date.now()
      if (entry && entry.expires > now) return entry.value
      const value = await fetcher()
      entry = { value, expires: now + ttlMs }
      return value
    },
    clear() {
      entry = null
    },
  }
}
