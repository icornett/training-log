#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/db/migrations}"

if [ "${1:-}" = "" ]; then
  echo "Usage: sh ./bin/db-new-migration.sh <description>" >&2
  echo "Example: sh ./bin/db-new-migration.sh add_exercise_sets" >&2
  exit 1
fi

DESC=$(printf "%s" "$1" | tr ' ' '_' | tr -cd '[:alnum:]_-' | tr '[:upper:]' '[:lower:]')
if [ "$DESC" = "" ]; then
  echo "Migration description is empty after sanitization." >&2
  exit 1
fi

mkdir -p "$MIGRATIONS_DIR"
STAMP=$(date +%Y%m%d%H%M%S)
BASE="$STAMP"_"$DESC"
UP_FILE="$MIGRATIONS_DIR/$BASE.up.sql"
DOWN_FILE="$MIGRATIONS_DIR/$BASE.down.sql"

if [ -e "$UP_FILE" ] || [ -e "$DOWN_FILE" ]; then
  echo "Migration files already exist for $BASE" >&2
  exit 1
fi

cat > "$UP_FILE" <<EOF
-- Migration: $BASE (up)
BEGIN;

-- Add forward migration SQL here.

COMMIT;
EOF

cat > "$DOWN_FILE" <<EOF
-- Migration: $BASE (down)
BEGIN;

-- Add rollback SQL here.

COMMIT;
EOF

echo "Created: $UP_FILE"
echo "Created: $DOWN_FILE"
