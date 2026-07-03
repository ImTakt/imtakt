#!/usr/bin/env bash
# Pre-release verification against the hosted or local API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${IMTAKT_SERVER_URL:-https://api.imtakt.dev}"

echo "==> ImTakt launch verify — API: ${API}"
echo ""

fail() { echo "FAIL: $1" >&2; exit 1; }

echo "1. Health"
HEALTH=$(curl -sf -m 15 "${API}/health" || curl -s -m 15 "${API}/health")
echo "${HEALTH}" | python3 -m json.tool 2>/dev/null || echo "${HEALTH}"
if ! echo "${HEALTH}" | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if d.get("capabilities",{}).get("journeys",{}).get("ok") else 1)' 2>/dev/null; then
  echo "WARN: health journeys.ok=false — continuing endpoint checks"
fi

echo ""
echo "2. Stops find"
curl -sf -m 15 -X POST "${API}/v1/stops/find" \
  -H 'content-type: application/json' \
  -d '{"place":"Alexanderplatz","limit":1}' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["matches"]' \
  || fail "stops/find"

echo "3. Journey plan"
curl -sf -m 25 -X POST "${API}/v1/journeys/plan" \
  -H 'content-type: application/json' \
  -d '{"from":"Berlin Hbf","to":"München Hbf","when":"2026-07-07T10:00:00.000Z"}' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert len(d.get("journeys",[]))>0' \
  || fail "journeys/plan"

STOP_ID=$(curl -sf -m 15 -X POST "${API}/v1/stops/find" \
  -H 'content-type: application/json' \
  -d '{"place":"Berlin Hbf","limit":1}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["matches"][0]["id"])')

echo "4. Board (${STOP_ID})"
BOARD=$(curl -sf -m 15 "${API}/v1/stops/${STOP_ID}/board")
echo "${BOARD}" | head -c 200
echo ""
echo "${BOARD}" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "departures" in d' \
  || fail "board shape"

echo ""
echo "5. npm pack smoke (local)"
bash "${ROOT}/scripts/npm-pack-smoke.sh"

if npm view @imtakt/mcp version >/dev/null 2>&1; then
  echo ""
  echo "6. npm registry"
  echo "   @imtakt/mcp $(npm view @imtakt/mcp version)"
  npx -y @imtakt/mcp --version
  npx -y @imtakt/cli --version
else
  echo ""
  echo "6. npm registry — SKIP (not published yet; run scripts/npm-publish.sh)"
fi

echo ""
echo "Launch verify passed."
