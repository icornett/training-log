#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:4280}"
API_LOG="${API_LOG:-/tmp/func.log}"
SWA_LOG="${SWA_LOG:-/tmp/swa.log}"

npm run dev:api:func:localdb >"${API_LOG}" 2>&1 &
API_PID=$!
npm run dev:swa:proxy >"${SWA_LOG}" 2>&1 &
SWA_PID=$!

cleanup() {
  kill "${API_PID}" "${SWA_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

npx wait-on http://127.0.0.1:7071 "${BASE_URL}" --timeout 90000

echo "Waiting for API routes to be ready behind SWA proxy..."
for i in $(seq 1 30); do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/account" || true)
  if [ "${http_code}" = "401" ]; then
    echo "API is ready (GET /api/account -> 401)."
    BASE_URL="${BASE_URL}" npm run test:e2e:localdb
    exit 0
  fi

  if [ "${i}" -eq 30 ]; then
    echo "API route readiness check failed. Last status: ${http_code}"
    echo "--- API log tail ---"
    tail -n 120 "${API_LOG}" || true
    echo "--- SWA log tail ---"
    tail -n 120 "${SWA_LOG}" || true
    exit 1
  fi

  sleep 2
done