#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run() {
  echo ""
  echo "=== $1 ==="
  shift
  "$@"
}

if [[ "${E2E_ONLY:-0}" != "1" ]]; then
  run "npm run build" npm run build
  run "npm run test" npm run test
fi

if [[ "${SKIP_E2E:-0}" != "1" ]]; then
  run "npm run test:e2e" npm run test:e2e
fi

echo ""
echo "OK: release regression passed."
