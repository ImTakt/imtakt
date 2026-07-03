#!/usr/bin/env bash
# Publish @imtakt/* 0.1.0 — run after api.imtakt.dev is live (A4).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

npm whoami >/dev/null || { echo "Run: npm login (npm org maintainer org account)" >&2; exit 1; }

echo "==> Pre-publish checks"
bash scripts/npm-pack-smoke.sh

echo "==> Audit (high severity and above)"
npm audit --workspaces --audit-level=high || {
  echo "WARN: npm audit reported issues — review before publishing" >&2
  if [[ "${ALLOW_AUDIT_FAIL:-}" != "1" ]]; then
    exit 1
  fi
}

PUBLISH_FLAGS=(--access public)
if $DRY_RUN; then
  PUBLISH_FLAGS+=(--dry-run)
  echo "==> Dry run — no packages will be published"
fi

for pkg in @imtakt/core @imtakt/sdk @imtakt/cli @imtakt/mcp; do
  echo "Publishing ${pkg}..."
  npm publish -w "$pkg" "${PUBLISH_FLAGS[@]}"
done

if ! $DRY_RUN; then
  echo ""
  echo "Published. Verify:"
  echo "  npx -y @imtakt/mcp"
  echo "  npx -y @imtakt/cli station Alexanderplatz"
fi
