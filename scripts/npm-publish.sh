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
audit_ok=true
for dir in packages/core packages/sdk packages/cli mcp; do
  if (cd "$ROOT/$dir" && npm i --package-lock-only --ignore-scripts >/dev/null 2>&1 && npm audit --audit-level=high >/dev/null 2>&1); then
    echo "OK  audit $dir"
  else
    echo "WARN audit $dir — review dependencies manually"
    audit_ok=false
  fi
done
if [[ "$audit_ok" != true && "${ALLOW_AUDIT_FAIL:-}" != "1" ]]; then
  echo "Audit failed — set ALLOW_AUDIT_FAIL=1 to publish after manual review" >&2
  exit 1
fi

PUBLISH_FLAGS=(--access public)
if $DRY_RUN; then
  PUBLISH_FLAGS+=(--dry-run)
  echo "==> Dry run — no packages will be published"
fi

for pkg in @imtakt/core @imtakt/sdk @imtakt/cli @imtakt/mcp; do
  echo "Publishing ${pkg}..."
  if ! npm publish -w "$pkg" "${PUBLISH_FLAGS[@]}"; then
    echo "" >&2
    echo "Publish failed. If you see E403 / 2FA:" >&2
    echo "  npm login   # complete OTP when prompted" >&2
    echo "  # or set a granular token with publish + bypass-2FA:" >&2
    echo "  npm config set //registry.npmjs.org/:_authToken=<token>" >&2
    echo "  # or pass OTP inline:" >&2
    echo "  npm publish -w ${pkg} --access public --otp=<code>" >&2
    exit 1
  fi
done

if ! $DRY_RUN; then
  echo ""
  echo "Published. Verify:"
  echo "  npx -y @imtakt/mcp"
  echo "  npx -y @imtakt/cli station Alexanderplatz"
fi
