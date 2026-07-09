#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"
BASELINE_FILE="${BASELINE_FILE:-$ROOT_DIR/db/baseline/main.sql}"
BASELINE_VERSION="${BASELINE_VERSION:-00000000000000_main_baseline}"
APPLY_BASELINE="${APPLY_BASELINE:-1}"
TARGET_VERSION="${1:-}"

DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-}"
DB_USER="${DB_USER:-traininglog}"
DB_NAME="${DB_NAME:-training_log}"

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

MIGRATION_COUNT=$(query_scalar "SELECT COUNT(*) FROM schema_migrations;")
if [ "$MIGRATION_COUNT" = "0" ] && [ "$APPLY_BASELINE" = "1" ] && [ -f "$BASELINE_FILE" ]; then
  echo "Applying baseline schema from $BASELINE_FILE"
  run_file "$BASELINE_FILE"

  BASE_ESC=$(sql_escape "$BASELINE_VERSION")
  run_sql "INSERT INTO schema_migrations (version, rollback_file) VALUES ('$BASE_ESC', NULL);"
  echo "Recorded baseline version: $BASELINE_VERSION"
fi

find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name "*.up.sql" | sort | while IFS= read -r UP_FILE; do
  VERSION=$(basename "$UP_FILE" ".up.sql")

  if [ -n "$TARGET_VERSION" ] && [ "$VERSION" \> "$TARGET_VERSION" ]; then
    continue
  fi

  APPLIED=$(query_scalar "SELECT 1 FROM schema_migrations WHERE version = '$(sql_escape "$VERSION")' LIMIT 1;")
  if [ "$APPLIED" = "1" ]; then
    continue
  fi

  DOWN_FILE="$MIGRATIONS_DIR/$VERSION.down.sql"
  if [ -f "$DOWN_FILE" ]; then
    ROLLBACK_VALUE="'$(sql_escape "$(basename "$DOWN_FILE")")'"
  else
    ROLLBACK_VALUE="NULL"
  fi

  echo "Applying migration: $VERSION"
  run_file "$UP_FILE"
  run_sql "INSERT INTO schema_migrations (version, rollback_file) VALUES ('$(sql_escape "$VERSION")', $ROLLBACK_VALUE);"
  echo "Applied migration: $VERSION"
done

echo "Migration run complete."
