#!/usr/bin/env sh
set -eu

CONTAINER_NAME="training-log-local-db"
DB_USER="traininglog"
DB_PASSWORD="traininglog"
DB_NAME="training_log"
DB_PORT="55432"
DB_IMAGE="postgres:16-alpine"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for local DB setup, but it is not installed or not on PATH." >&2
  exit 1
fi

if [ -z "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
  echo "Creating local Postgres container ${CONTAINER_NAME}..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -e POSTGRES_DB="${DB_NAME}" \
    -p "${DB_PORT}:5432" \
    "${DB_IMAGE}" >/dev/null
else
  if [ -z "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Starting existing local Postgres container ${CONTAINER_NAME}..."
    docker start "${CONTAINER_NAME}" >/dev/null
  fi
fi

echo "Waiting for Postgres to become ready..."
TRIES=0
until docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "${TRIES}" -ge 30 ]; then
    echo "Timed out waiting for Postgres to become ready." >&2
    exit 1
  fi
  sleep 1
done

echo "Applying schema.sql to local Postgres..."
TRIES=0
until docker exec -i "${CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" < schema.sql >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "${TRIES}" -ge 30 ]; then
    echo "Timed out applying schema.sql to local Postgres." >&2
    docker logs --tail 40 "${CONTAINER_NAME}" >&2 || true
    exit 1
  fi
  sleep 1
done

echo "Local DB is ready at postgresql://${DB_USER}:***@127.0.0.1:${DB_PORT}/${DB_NAME}"
