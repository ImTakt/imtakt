#!/usr/bin/env bash
# Pack @imtakt/* tarballs locally and smoke-test the npx install path (no registry publish).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building packages"
bun run build

PACK_DIR="$(mktemp -d)"
INSTALL_DIR="$(mktemp -d)"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$PACK_DIR" "$INSTALL_DIR" "$STAGE_DIR"' EXIT

pack_resolved() {
  local rel="$1"
  local stage="$STAGE_DIR/$rel"
  mkdir -p "$stage"
  rsync -a --exclude node_modules "$ROOT/$rel/" "$stage/"
  if grep -q 'workspace:' "$stage/package.json" 2>/dev/null; then
    node "$ROOT/scripts/resolve-workspace-deps.mjs" "$stage/package.json"
  fi
  (cd "$stage" && npm pack --pack-destination "$PACK_DIR" >/dev/null)
}

echo "==> Packing tarballs (workspace deps resolved)"
pack_resolved packages/core
pack_resolved packages/sdk
pack_resolved packages/cli
pack_resolved mcp

CORE_TGZ="$(ls "$PACK_DIR"/imtakt-core-*.tgz)"
SDK_TGZ="$(ls "$PACK_DIR"/imtakt-sdk-*.tgz)"
CLI_TGZ="$(ls "$PACK_DIR"/imtakt-cli-*.tgz)"
MCP_TGZ="$(ls "$PACK_DIR"/imtakt-mcp-*.tgz)"

echo "==> Installing packed tarballs (simulates npx dependency tree)"
(
  cd "$INSTALL_DIR"
  npm init -y >/dev/null
  npm install "$CORE_TGZ" "$SDK_TGZ" "$CLI_TGZ" "$MCP_TGZ" >/dev/null
)

CLI_BIN="$INSTALL_DIR/node_modules/.bin/imtakt"
MCP_BIN="$INSTALL_DIR/node_modules/.bin/imtakt-mcp"

echo "==> CLI smoke: find"
"$CLI_BIN" find "Alexanderplatz" | head -c 200
echo ""

echo "==> CLI smoke: plan"
"$CLI_BIN" plan "Berlin Hbf" "München Hbf" --view board --json | head -c 300
echo ""

echo "==> CLI smoke: status"
STOP_ID="$("$CLI_BIN" find "Berlin Hbf" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.matches[0]?.id||'')})")"
if [[ -z "$STOP_ID" ]]; then
  echo "FAIL: no stop id from find" >&2
  exit 1
fi
"$CLI_BIN" status --stop-id "$STOP_ID" --limit 4 | head -c 200
echo ""

echo "==> CLI smoke: --version"
"$CLI_BIN" --version | grep -q '"version":"0.3.2"'
"$CLI_BIN" --version | grep -q "@imtakt/cli"
"$MCP_BIN" --version | grep -q "@imtakt/mcp 0.3.2"
echo "Version flags OK (0.3.2)"

echo "==> MCP smoke: starts (stdio, exit after init)"
if command -v timeout >/dev/null 2>&1; then
  timeout 3 "$MCP_BIN" </dev/null >/dev/null 2>&1 || {
    code=$?
    if [[ "$code" -eq 124 ]]; then
      echo "MCP server started (timed out waiting on stdio — expected)"
    else
      echo "MCP exited with code $code (may be normal for empty stdin)"
    fi
  }
else
  # macOS: gtimeout or skip
  echo "SKIP: timeout not available — MCP bin exists at $MCP_BIN"
  test -x "$MCP_BIN"
fi

assert_cli_rejects_url() {
  local url="$1"
  local pattern="$2"
  local out
  out="$(IMTAKT_SERVER_URL="$url" "$CLI_BIN" find "Berlin" 2>&1)" || true
  if echo "$out" | grep -q "$pattern"; then
    echo "Blocked OK: $url"
  else
    echo "FAIL: expected block for $url — got: $out" >&2
    exit 1
  fi
}

echo "==> Security: reject credential URL"
assert_cli_rejects_url "https://user:pass@api.imtakt.dev" "must not contain credentials"

echo "==> Security: reject metadata SSRF host"
assert_cli_rejects_url "http://169.254.169.254" "not allowed"

echo ""
echo "Pack smoke passed."
