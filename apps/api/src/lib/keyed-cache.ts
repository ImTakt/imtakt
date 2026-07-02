/** LRU cache with TTL and single-flight dedup for hot read paths. */
export function createKeyedCache<T>(options: { ttlMs: number; maxEntries: number }) {
  const { ttlMs, maxEntries } = options
  const entries = new Map<string, { value: T; expires: number }>()
  const inflight = new Map<string, Promise<T>>()

  function prune(): void {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) break
      entries.delete(oldest)
    }
  }

  return {
    async get(key: string, fetcher: () => Promise<T>): Promise<T> {
      const now = Date.now()
      const hit = entries.get(key)
      if (hit && hit.expires > now) {
        entries.delete(key)
        entries.set(key, hit)
        return hit.value
      }

      const pending = inflight.get(key)
      if (pending) return pending

      const promise = fetcher()
        .then((value) => {
          entries.set(key, { value, expires: Date.now() + ttlMs })
          prune()
          return value
        })
        .finally(() => {
          inflight.delete(key)
        })

      inflight.set(key, promise)
      return promise
    },

    clear(): void {
      entries.clear()
      inflight.clear()
    },

    delete(key: string): void {
      entries.delete(key)
    },
  }
}

export type KeyedCache<T> = ReturnType<typeof createKeyedCache<T>>
