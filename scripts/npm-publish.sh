#!/usr/bin/env bash
# Publish @imtakt/* 0.1.0 — run after api.imtakt.dev is live (A4).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm whoami >/dev/null || { echo "Run: npm login" >&2; exit 1; }

for pkg in packages/core packages/sdk packages/cli mcp; do
  echo "Publishing ${pkg}..."
  (cd "$pkg" && npm publish --access public)
done

echo "Done. Verify: npx -y @imtakt/mcp"
