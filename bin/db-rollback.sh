#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"
STEPS="${1:-1}"

DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-}"
DB_USER="${DB_USER:-traininglog}"
DB_NAME="${DB_NAME:-training_log}"

case "$STEPS" in
  ''|*[!0-9]*)
    echo "Rollback steps must be a positive integer." >&2
    exit 1
    ;;
esac

if [ "$STEPS" -lt 1 ]; then
  echo "Rollback steps must be at least 1." >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

run_sql() {
  SQL="$1"
  if [ -n "$DB_CONTAINER_NAME" ]; then
    docker exec -i "$DB_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "$SQL" >/dev/null
  else
    if ! command -v psql >/dev/null 2>&1; then
      echo "psql not found. Install PostgreSQL client or set DB_CONTAINER_NAME." >&2
      exit 1
    fi
    psql -v ON_ERROR_STOP=1 -c "$SQL" >/dev/null
  fi
}

run_file() {
  FILE="$1"
  if [ -n "$DB_CONTAINER_NAME" ]; then
    docker exec -i "$DB_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$FILE" >/dev/null
  else
    if ! command -v psql >/dev/null 2>&1; then
      echo "psql not found. Install PostgreSQL client or set DB_CONTAINER_NAME." >&2
      exit 1
    fi
    psql -v ON_ERROR_STOP=1 -f "$FILE" >/dev/null
  fi
}

query_scalar() {
  SQL="$1"
  if [ -n "$DB_CONTAINER_NAME" ]; then
    docker exec -i "$DB_CONTAINER_NAME" psql -At -U "$DB_USER" -d "$DB_NAME" -c "$SQL"
  else
    if ! command -v psql >/dev/null 2>&1; then
      echo "psql not found. Install PostgreSQL client or set DB_CONTAINER_NAME." >&2
      exit 1
    fi
    psql -At -c "$SQL"
  fi
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

run_sql "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(255) PRIMARY KEY,
  rollback_file text,
  applied_at timestamptz NOT NULL DEFAULT NOW()
);
"

INDEX=0
while [ "$INDEX" -lt "$STEPS" ]; do
  LATEST=$(query_scalar "SELECT version || '|' || rollback_file FROM schema_migrations WHERE rollback_file IS NOT NULL ORDER BY applied_at DESC, version DESC LIMIT 1;")

  if [ "$LATEST" = "" ]; then
    echo "No rollbackable migrations found."
    break
  fi

  VERSION=${LATEST%%|*}
  ROLLBACK_FILE=${LATEST#*|}
  DOWN_FILE="$MIGRATIONS_DIR/$ROLLBACK_FILE"

  if [ ! -f "$DOWN_FILE" ]; then
    echo "Rollback file missing for migration $VERSION: $DOWN_FILE" >&2
    exit 1
  fi

  echo "Rolling back migration: $VERSION"
  run_file "$DOWN_FILE"
  run_sql "DELETE FROM schema_migrations WHERE version = '$(sql_escape "$VERSION")';"
  echo "Rolled back migration: $VERSION"

  INDEX=$((INDEX + 1))
done

echo "Rollback complete."
