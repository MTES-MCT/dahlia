#!/usr/bin/env bash
# Create a Scalingo PostgreSQL backup and restore it into the local Docker Postgres.
set -euo pipefail

cd "$(dirname "$0")/.."

SCALINGO_APP="${SCALINGO_APP:?Set SCALINGO_APP (e.g. dahlia-prod or dahlia-preprod)}"
SCALINGO_REGION="${SCALINGO_REGION:-osc-secnum-fr1}"
SCALINGO_ADDON="${SCALINGO_ADDON:-postgresql}"
LOCAL_PG_DB="${LOCAL_PG_DB:-dahlia}"
LOCAL_PG_USER="${LOCAL_PG_USER:-dahlia}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-dahlia-webapp-db}"
BACKUP_DIR="${BACKUP_DIR:-tmp/db-backups}"
CONTAINER_DUMP_PATH="/tmp/dahlia-restore.dump"

if ! [[ "$LOCAL_PG_DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  printf 'Refusing database name %q\n' "$LOCAL_PG_DB" >&2
  exit 1
fi

if ! [[ "$LOCAL_PG_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  printf 'Refusing database user %q\n' "$LOCAL_PG_USER" >&2
  exit 1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command scalingo
require_command docker
require_command tar

if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$COMPOSE_SERVICE"; then
  printf 'Postgres is not running. Start it with: docker compose up -d\n' >&2
  exit 1
fi

if [ "${CONFIRM:-}" != "1" ]; then
  if [ ! -r /dev/tty ]; then
    printf 'No terminal available. Re-run with CONFIRM=1 to skip the prompt.\n' >&2
    exit 1
  fi
  cat <<EOF
This will:
  1. create a backup of the Scalingo database (${SCALINGO_APP})
  2. download it
  3. replace the local Docker database "${LOCAL_PG_DB}" with that backup

Remote data may include personal data. The local database will be dropped.
Continue? [y/N]
EOF
  read -r answer </dev/tty
  case "$answer" in
    y | Y | yes | oui) ;;
    *)
      printf 'Aborted.\n'
      exit 1
      ;;
  esac
fi

fetch_backups() {
  NO_COLOR=1 scalingo \
    --region "$SCALINGO_REGION" \
    --app "$SCALINGO_APP" \
    --addon "$SCALINGO_ADDON" \
    backups | sed 's/\x1b\[[0-9;]*m//g'
}

backup_ids() {
  printf '%s\n' "$1" | grep -Eo '[0-9a-f]{24}' || true
}

printf 'Listing existing backups for %s...\n' "$SCALINGO_APP"
before="$(fetch_backups)"

printf 'Creating a new backup (Scalingo waits until it finishes)...\n'
scalingo \
  --region "$SCALINGO_REGION" \
  --app "$SCALINGO_APP" \
  --addon "$SCALINGO_ADDON" \
  backups-create

after="$(fetch_backups)"

new_id=""
while IFS= read -r id; do
  [ -n "$id" ] || continue
  if ! backup_ids "$before" | grep -qx "$id"; then
    new_id="$id"
    break
  fi
done < <(backup_ids "$after")

if [ -z "$new_id" ]; then
  printf 'No new backup id found after backups-create.\n' >&2
  printf '%s\n' "$after" >&2
  exit 1
fi

backup_line=""
while IFS= read -r candidate; do
  case "$candidate" in
    *"$new_id"*)
      backup_line="$candidate"
      break
      ;;
  esac
done <<EOF
$after
EOF

if ! printf '%s\n' "$backup_line" | grep -Eq '(^|[[:space:]|])done([[:space:]|]|$)'; then
  printf 'Backup %s did not finish successfully:\n%s\n' "$new_id" "$backup_line" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
archive="${BACKUP_DIR}/${SCALINGO_APP}-${new_id}.tar.gz"
# Scalingo CLI opens the output file without truncating it.
rm -f "$archive"

printf 'Downloading backup %s...\n' "$new_id"
scalingo \
  --region "$SCALINGO_REGION" \
  --app "$SCALINGO_APP" \
  --addon "$SCALINGO_ADDON" \
  backups-download \
  --backup "$new_id" \
  --output "$archive" \
  --silent

if [ ! -s "$archive" ]; then
  printf 'Downloaded archive is empty: %s\n' "$archive" >&2
  exit 1
fi

extract_dir="${BACKUP_DIR}/${SCALINGO_APP}-${new_id}"
rm -rf "$extract_dir"
mkdir -p "$extract_dir"
tar -xzf "$archive" -C "$extract_dir"

dump=""
while IFS= read -r file; do
  [ -n "$file" ] || continue
  dump="$file"
  break
done < <(find "$extract_dir" -type f ! -name '.*')

if [ -z "$dump" ]; then
  printf 'No dump file found in %s\n' "$archive" >&2
  exit 1
fi

magic="$(od -An -t x1 -N 2 "$dump" | tr -d ' \n')"
if [ "$magic" = "1f8b" ]; then
  gunzip -c "$dump" >"${dump}.pgsql"
  dump="${dump}.pgsql"
fi

header="$(od -An -t c -N 5 "$dump" | tr -d ' \n')"
case "$header" in
  PGDMP) ;;
  *)
    printf 'Dump %s is not a PostgreSQL custom-format archive (header %s).\n' "$dump" "$header" >&2
    exit 1
    ;;
esac

printf 'Replacing local database %s...\n' "$LOCAL_PG_DB"
docker compose exec -T "$COMPOSE_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$LOCAL_PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"${LOCAL_PG_DB}\" WITH (FORCE);" \
  -c "CREATE DATABASE \"${LOCAL_PG_DB}\";"

docker compose cp "$dump" "${COMPOSE_SERVICE}:${CONTAINER_DUMP_PATH}"

set +e
docker compose exec -T "$COMPOSE_SERVICE" \
  pg_restore \
  --no-owner \
  --no-privileges \
  --no-comments \
  --username "$LOCAL_PG_USER" \
  --dbname "$LOCAL_PG_DB" \
  "$CONTAINER_DUMP_PATH"
restore_status=$?
set -e

docker compose exec -T "$COMPOSE_SERVICE" rm -f "$CONTAINER_DUMP_PATH"

restored="$(docker compose exec -T "$COMPOSE_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$LOCAL_PG_USER" -d "$LOCAL_PG_DB" -tAc \
  "SELECT to_regclass('public.case_files') IS NOT NULL;")"
restored="$(printf '%s' "$restored" | tr -d '[:space:]')"

if [ "$restored" != "t" ]; then
  printf 'Restore failed: public.case_files is missing (pg_restore exit %s).\n' "$restore_status" >&2
  exit 1
fi

if [ "$restore_status" -ne 0 ]; then
  printf 'pg_restore exited with %s. public.case_files is present; review the messages above.\n' "$restore_status"
fi

printf 'Local database %s now contains backup %s from %s.\n' "$LOCAL_PG_DB" "$new_id" "$SCALINGO_APP"
printf 'Archive kept at %s\n' "$archive"
