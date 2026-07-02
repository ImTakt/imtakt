#!/usr/bin/env bash
# Start ImTakt Server locally — expects Meilisearch + feed manifest from sibling imtakt-gtfs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GTFS_ROOT="${IMTAKT_GTFS_ROOT:-${ROOT}/../imtakt-gtfs}"
cd "$ROOT"

export PORT="${PORT:-3011}"
export IMTAKT_SERVER_URL="${IMTAKT_SERVER_URL:-http://localhost:${PORT}}"
export MEILI_URL="${MEILI_URL:-http://localhost:7700}"
export MEILI_MASTER_KEY="${MEILI_MASTER_KEY:-dev-master-key}"
export FEED_MANIFEST_PATH="${FEED_MANIFEST_PATH:-${GTFS_ROOT}/apps/feeds/data/de_full/.feed-manifest.json}"
export DATABASE_URL="${DATABASE_URL:-postgres://imtakt:imtakt-dev@localhost:5432/imtakt}"
export MOTIS_URL="${MOTIS_URL:-http://localhost:8080}"

if ! curl -sf "${MEILI_URL}/health" >/dev/null; then
  echo "Data harness not reachable at ${MEILI_URL}" >&2
  echo "Run in imtakt-gtfs: docker compose up -d" >&2
  exit 1
fi

if [[ ! -f "${FEED_MANIFEST_PATH}" ]]; then
  echo "Feed manifest missing at ${FEED_MANIFEST_PATH}" >&2
  echo "Run in imtakt-gtfs: bun run feeds:refresh" >&2
fi

echo "ImTakt Server → http://localhost:${PORT}"
echo "  Stops:    ${MEILI_URL}"
echo "  GTFS:     ${GTFS_ROOT}"
echo "  Manifest: ${FEED_MANIFEST_PATH}"
exec bun run --filter @imtakt/api dev
