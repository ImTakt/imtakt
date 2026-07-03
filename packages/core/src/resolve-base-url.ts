import { IMTAKT_HOSTED_API_URL } from "./constants.js"

/** Hostnames blocked for env/flag overrides (SSRF hardening). */
const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
])

/**
 * Resolve ImTakt API base URL from explicit option, env, or hosted default.
 * Validates protocol and rejects credential-bearing URLs.
 */
export function resolveBaseUrl(explicit?: string, envValue?: string): string {
  const raw = explicit ?? envValue ?? IMTAKT_HOSTED_API_URL
  return validateBaseUrl(raw)
}

/** Normalize and validate a user-supplied API base URL. */
export function validateBaseUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid ImTakt server URL: ${raw}`)
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`ImTakt server URL must use http or https, got: ${url.protocol}`)
  }

  if (url.username || url.password) {
    throw new Error("ImTakt server URL must not contain credentials")
  }

  if (BLOCKED_HOSTS.has(url.hostname)) {
    throw new Error(`ImTakt server URL host is not allowed: ${url.hostname}`)
  }

  if (raw.startsWith(IMTAKT_HOSTED_API_URL) && url.protocol !== "https:") {
    throw new Error("Hosted ImTakt API requires https")
  }

  const pathname = url.pathname.replace(/\/+$/, "")
  return `${url.origin}${pathname}`
}
