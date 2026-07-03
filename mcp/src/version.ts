import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** Read version from nearest package.json (for --version). */
export function readPackageVersion(): string {
  const dir = dirname(fileURLToPath(import.meta.url))
  const pkgPath = join(dir, "..", "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }
  return pkg.version ?? "0.0.0"
}
