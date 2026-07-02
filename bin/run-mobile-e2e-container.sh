#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the mobile E2E suite in a container." >&2
  exit 1
fi

PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-ghcr.io/icornett/training-log-playwright:latest}"
CONTAINER_HOME="/tmp/container-home"
NPM_PREFIX="/tmp/npm-global"

npm run db:local:prepare

docker run --rm --init \
  --user "$(id -u):$(id -g)" \
  --add-host host.docker.internal:host-gateway \
  -e HOME="${CONTAINER_HOME}" \
  -e NPM_CONFIG_PREFIX="${NPM_PREFIX}" \
  -e PATH="${NPM_PREFIX}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  -e LOCAL_DB_HOST=host.docker.internal \
  -e DATABASE_URL="postgresql://traininglog:traininglog@host.docker.internal:55432/training_log?sslmode=disable" \
  -e SESSION_SECRET="${SESSION_SECRET:-container-mobile-session-secret}" \
  -e AzureWebJobsStorage="${AzureWebJobsStorage:-UseDevelopmentStorage=true}" \
  -e FUNCTIONS_WORKER_RUNTIME="${FUNCTIONS_WORKER_RUNTIME:-node}" \
  -e DISABLE_TIMER_TRIGGERS="${DISABLE_TIMER_TRIGGERS:-true}" \
  -e CI=1 \
  -v "$PWD":/work \
  -w /work \
  "${PLAYWRIGHT_IMAGE}" \
  sh -lc '
    mkdir -p "$HOME" "$NPM_CONFIG_PREFIX/bin"
    npm ci --include=dev --ignore-scripts
    npm --prefix api ci --ignore-scripts
    npx -y node@22 /usr/bin/npm i -g azure-functions-core-tools@4 --unsafe-perm true
    rm -f "$NPM_CONFIG_PREFIX/bin/func"
    cat >"$NPM_CONFIG_PREFIX/bin/func" <<"EOF"
#!/usr/bin/env sh
exec npx -y node@22 "$NPM_CONFIG_PREFIX/lib/node_modules/azure-functions-core-tools/lib/main.js" "$@"
EOF
    chmod +x "$NPM_CONFIG_PREFIX/bin/func"
    npm run dev:api:func:localdb >/tmp/func.log 2>&1 &
    API_PID=$!
    cleanup() {
      kill "$API_PID" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM
    npx wait-on http://127.0.0.1:7071 --timeout 90000
    npm run test:e2e:mobile
  '
