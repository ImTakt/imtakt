import { describe, expect, test } from "bun:test"
import { IMTAKT_HOSTED_API_URL } from "./constants.js"
import { resolveBaseUrl, validateBaseUrl } from "./resolve-base-url.js"

describe("resolveBaseUrl", () => {
  test("defaults to hosted API", () => {
    expect(resolveBaseUrl()).toBe(IMTAKT_HOSTED_API_URL)
  })

  test("accepts explicit override", () => {
    expect(resolveBaseUrl("http://localhost:3011")).toBe("http://localhost:3011")
  })

  test("strips trailing slash", () => {
    expect(validateBaseUrl("https://api.imtakt.dev/")).toBe("https://api.imtakt.dev")
  })

  test("rejects credentials in URL", () => {
    expect(() => validateBaseUrl("https://user:pass@api.imtakt.dev")).toThrow(
      "must not contain credentials",
    )
  })

  test("rejects cloud metadata host", () => {
    expect(() => validateBaseUrl("http://169.254.169.254")).toThrow("not allowed")
  })

  test("rejects non-http schemes", () => {
    expect(() => validateBaseUrl("file:///etc/passwd")).toThrow("http or https")
  })
})
