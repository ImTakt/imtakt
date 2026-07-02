import { config } from "../config"

type JsonClient = {
  getJson<T>(path: string, init?: RequestInit): Promise<T>
  postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T>
  head(path: string, init?: RequestInit): Promise<Response>
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

function withTimeout(init: RequestInit | undefined, timeoutMs: number): RequestInit {
  if (timeoutMs <= 0) return init ?? {}
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs)
  return { ...init, signal }
}

/** Bun fetch pools connections per origin when clients are reused. */
export function createJsonClient(
  baseUrl: string,
  defaultHeaders: Record<string, string> = {},
  timeoutMs = config.upstreamTimeoutMs,
): JsonClient {
  const headers = { accept: "application/json", ...defaultHeaders }

  return {
    async getJson<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await fetch(joinUrl(baseUrl, path), {
        ...withTimeout(init, timeoutMs),
        method: "GET",
        headers: { ...headers, ...init?.headers },
      })
      if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
      return res.json() as Promise<T>
    },

    async postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const res = await fetch(joinUrl(baseUrl, path), {
        ...withTimeout(init, timeoutMs),
        method: "POST",
        headers: { "content-type": "application/json", ...headers, ...init?.headers },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
      return res.json() as Promise<T>
    },

    async head(path: string, init?: RequestInit): Promise<Response> {
      return fetch(joinUrl(baseUrl, path), {
        ...withTimeout(init, timeoutMs),
        method: "HEAD",
        headers: { ...headers, ...init?.headers },
      })
    },
  }
}

const meiliAuth: Record<string, string> = {}
if (config.meiliKey) meiliAuth.authorization = `Bearer ${config.meiliKey}`

export const meiliClient = createJsonClient(config.meiliUrl, meiliAuth, config.meiliTimeoutMs)
export const routerClient = createJsonClient(config.motisUrl, {}, config.routerTimeoutMs)
