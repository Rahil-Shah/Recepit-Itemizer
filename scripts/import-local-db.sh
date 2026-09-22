#!/usr/bin/env bash
#
# Copy the rows from the local Docker Postgres into a hosted one (Supabase,
# Neon, RDS, ...) without touching the schema.
#
#   ./scripts/import-local-db.sh "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
#
# The target must already have the schema, which `npm run db:deploy` or a
# Vercel build creates. This copies data only, and leaves Prisma's migration
# history on the target alone: the target's own history is the correct one.
#
# Nothing is written unless every check passes, and the restore runs in one
# transaction, so a failure leaves the target exactly as it was.
set -euo pipefail

CONTAINER="${RECEIPT_DB_CONTAINER:-receipt-ring-db}"
SOURCE_DB="${RECEIPT_DB_NAME:-receipt_ring}"
SOURCE_USER="${RECEIPT_DB_USER:-receipt}"
SOURCE_PORT="${RECEIPT_DB_PORT:-5433}"
SOURCE_HOST="${RECEIPT_DB_HOST:-localhost}"
DUMP_FILE="${RECEIPT_DUMP_FILE:-receipt-ring-data.sql}"

# Tables whose contents are transient and must not travel:
#   _prisma_migrations  the target's own history is the correct one
#   rate_limits         counters for the machine that wrote them; copying a
#                       window from a laptop can lock an address out of the
#                       live site, and the primary keys collide on restore
#   sessions            a login token held by a browser that will never send
#                       it to the new host. Credential-adjacent and useless.
SKIP_TABLES=(_prisma_migrations rate_limits sessions)
REPLACE=0

die() { printf '\nError: %s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }

for arg in "$@"; do
  case "$arg" in
    --replace) REPLACE=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) TARGET="${TARGET:-$arg}" ;;
  esac
done

TARGET="${TARGET:-${TARGET_DATABASE_URL:-}}"
[ -n "$TARGET" ] || die "Pass the target connection string as the first argument, or set TARGET_DATABASE_URL."

# --- The mistakes that are easy to make and slow to diagnose ---------------

case "$TARGET" in
  postgres://*|postgresql://*) ;;
  *) die "That does not look like a connection string. It should start with postgresql://" ;;
esac

# A copied template still carrying its placeholders fails later with a DNS or
# authentication error that says nothing about the real cause.
for placeholder in REGION YOUR_PASSWORD YOUR-PASSWORD "<" ">" "[" "]" "your-project" "PASSWORD@"; do
  case "$TARGET" in
    *"$placeholder"*) die "The connection string still contains the placeholder '$placeholder'. Copy the real string from your database provider." ;;
  esac
done

# Supabase's transaction pooler (6543) cannot hold a transaction open across
# the whole restore. The session pooler (5432) can.
case "$TARGET" in
  *:6543/*)
    die "Port 6543 is the transaction pooler. Use the session pooler (port 5432) for an import."
    ;;
esac

# --- Which client tools to use ---------------------------------------------
# Prefer the ones inside the database container: they match the server that
# produced the dump, and they are there even when the host has no psql.

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  MODE="docker"
  SRC=(docker exec -i "$CONTAINER" )
  SRC_CONN=(-U "$SOURCE_USER" -d "$SOURCE_DB")
else
  command -v psql >/dev/null 2>&1 || die "The container '$CONTAINER' is not running (start it with: npm run db:up) and no local psql was found."
  MODE="local"
  SRC=()
  SRC_CONN=(-h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB")
fi

src_psql() { "${SRC[@]}" psql "${SRC_CONN[@]}" "$@"; }
src_dump() { "${SRC[@]}" pg_dump "${SRC_CONN[@]}" "$@"; }
dst_psql() { "${SRC[@]}" psql "$TARGET" "$@"; }

COUNTS="select (select count(*) from users) || ' users, ' ||
               (select count(*) from receipts) || ' receipts, ' ||
               (select count(*) from receipt_lines) || ' lines, ' ||
               (select count(*) from line_assignments) || ' assignments, ' ||
               (select count(*) from account_people) || ' people, ' ||
               (select count(*) from item_aliases) || ' aliases, ' ||
               (select count(*) from rent_entries) || ' rent, ' ||
               (select count(*) from bank_transactions) || ' transactions'"

step "1. Local database ($MODE)"
src_psql -At -c "select 1" >/dev/null || die "Cannot reach the local database."
ok "reachable"
SOURCE_COUNTS="$(src_psql -At -c "$COUNTS")"
ok "holds $SOURCE_COUNTS"

step "2. Target database"
dst_psql -At -c "select 1" >/dev/null 2>&1 || die "Cannot reach the target. Check the host, the password (percent-encode any @ # / : ? in it) and that you copied the session pooler string."
ok "reachable"

TABLES="$(dst_psql -At -c "select count(*) from information_schema.tables where table_schema='public'")"
[ "$TABLES" -ge 13 ] || die "The target has only $TABLES tables in the public schema. Create the schema first: DIRECT_DATABASE_URL=\"$TARGET\" npm run db:deploy"
ok "schema present ($TABLES tables)"

TARGET_ROWS="$(dst_psql -At -c "select (select count(*) from users) + (select count(*) from receipts)")"
if [ "$TARGET_ROWS" -ne 0 ]; then
  TARGET_COUNTS="$(dst_psql -At -c "$COUNTS")"
  if [ "$REPLACE" -eq 0 ]; then
    die "The target is not empty. It holds $TARGET_COUNTS.
  This usually means an account was created on the live site before the import.
  Re-run with --replace to erase what is there and import the local data instead."
  fi
  printf '  ! not empty: holds %s\n' "$TARGET_COUNTS"
  printf '  ! --replace given, so this will be erased and replaced\n'
else
  ok "empty, nothing to overwrite"
fi

step "3. Dumping local rows"
EXCLUDES=()
for skip in "${SKIP_TABLES[@]}"; do EXCLUDES+=(--exclude-table="$skip"); done
src_dump --data-only --no-owner --no-privileges "${EXCLUDES[@]}" > "$DUMP_FILE"
BLOCKS="$(grep -c '^COPY ' "$DUMP_FILE" || true)"
[ "$BLOCKS" -gt 0 ] || die "The dump contains no data. Is the local database the right one?"
ok "$DUMP_FILE written, $BLOCKS tables"

step "4. Restoring into the target"
# Emptying the target and filling it belong to ONE transaction. Truncating in
# a statement of its own would leave the target empty if the restore then
# failed -- destroying data to import data is the one outcome worth ruling
# out. Every table is listed rather than a fixed set, so a table added later
# cannot be silently left behind.
RESTORE_FILE="${DUMP_FILE}.restore"
: > "$RESTORE_FILE"
if [ "$REPLACE" -eq 1 ]; then
  cat >> "$RESTORE_FILE" <<'PRELUDE'
-- CASCADE announces every table it reaches, which is noise here.
SET client_min_messages = warning;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  LOOP EXECUTE format('TRUNCATE TABLE %I CASCADE', t); END LOOP;
END $$;
PRELUDE
fi
cat "$DUMP_FILE" >> "$RESTORE_FILE"

# One transaction: any error rolls the whole thing back and writes nothing.
# stdout is dropped because the dump's own SET statements print result rows
# that mean nothing here; errors still come through on stderr.
dst_psql -v ON_ERROR_STOP=1 --single-transaction -q < "$RESTORE_FILE" >/dev/null
rm -f "$RESTORE_FILE"
ok "restored"

step "5. Verifying"
TARGET_COUNTS="$(dst_psql -At -c "$COUNTS")"
printf '  local:  %s\n  target: %s\n' "$SOURCE_COUNTS" "$TARGET_COUNTS"
if [ "$SOURCE_COUNTS" = "$TARGET_COUNTS" ]; then
  ok "identical"
  printf '\nDone. Sign in with your existing email and password.\n'
  printf 'Your saved Gemini key and any bank connection only decrypt if TOKEN_ENCRYPTION_KEY\n'
  printf 'on the server matches the one in your local .env.\n'
else
  die "The counts do not match. The target was left with what you see above."
fi
