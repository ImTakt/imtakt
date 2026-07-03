#!/usr/bin/env node
/** Replace workspace:* deps with ^version for pack/smoke installs. */
import { readFileSync, writeFileSync } from "node:fs"

const pkgPath = process.argv[2]
if (!pkgPath) {
  console.error("Usage: resolve-workspace-deps.mjs <package.json>")
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
const version = pkg.version ?? "0.1.0"

for (const [dep, spec] of Object.entries(pkg.dependencies ?? {})) {
  if (typeof spec === "string" && spec.startsWith("workspace:")) {
    pkg.dependencies[dep] = `^${version}`
  }
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
