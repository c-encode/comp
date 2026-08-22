#!/usr/bin/env bash
#
# Bootstrap an RDS Postgres instance for Comp AI.
#
# Creates a dedicated least-privilege application role and a `comp` database
# owned by it, and pre-creates the pgcrypto extension as the master user so the
# app role never needs superuser.
#
# Run from the EC2 box (it needs network access to RDS). Requires `psql`:
#   sudo dnf install -y postgresql16
#
# Usage:
#   export RDS_HOST=comp.xxxx.ca-central-1.rds.amazonaws.com
#   export RDS_MASTER_USER=postgres
#   export RDS_MASTER_PASSWORD='...'
#   ./rds-bootstrap.sh
#
# Prints the DATABASE_URL to paste into the four .env files.
set -euo pipefail

# Prompt for anything not already in the environment. Exporting in one shell and
# running the script in another is easy to do and the failure is silent, so ask
# rather than exit.
if [[ -z "${RDS_HOST:-}" ]]; then
  read -rp 'RDS endpoint (host): ' RDS_HOST
fi
if [[ -z "${RDS_MASTER_USER:-}" ]]; then
  read -rp 'RDS master username [postgres]: ' RDS_MASTER_USER
  RDS_MASTER_USER="${RDS_MASTER_USER:-postgres}"
fi
if [[ -z "${RDS_MASTER_PASSWORD:-}" ]]; then
  read -rsp 'RDS master password: ' RDS_MASTER_PASSWORD
  echo
fi

if [[ -z "$RDS_HOST" || -z "$RDS_MASTER_PASSWORD" ]]; then
  echo "ERROR: host and password are both required." >&2
  exit 1
fi

: "${APP_DB:=comp}"
: "${APP_USER:=comp_app}"

echo "host=${RDS_HOST}  user=${RDS_MASTER_USER}  password=${#RDS_MASTER_PASSWORD} chars"

# Fail fast instead of letting psql hang on an unreachable host.
if ! timeout 8 bash -c "cat < /dev/null > /dev/tcp/${RDS_HOST}/5432" 2>/dev/null; then
  echo "ERROR: cannot reach ${RDS_HOST}:5432 — check the RDS security group" >&2
  exit 1
fi
echo "tcp 5432 reachable"

# psql would otherwise prompt (and appear to hang) on a bad password.
export PGCONNECT_TIMEOUT=10

# Generate an app password unless one was supplied. Avoids characters that need
# URL-encoding inside a DATABASE_URL (@ : / ? # & % +).
if [[ -z "${APP_PASSWORD:-}" ]]; then
  # No pipeline: `tr ... | head -c` SIGPIPEs tr, which under `set -o pipefail`
  # plus `set -e` kills the script silently inside a command substitution.
  # openssl hex output is URL-safe, so it needs no encoding in DATABASE_URL.
  APP_PASSWORD="$(openssl rand -hex 20)"
  GENERATED=1
fi

MASTER_URL="postgresql://${RDS_MASTER_USER}:${RDS_MASTER_PASSWORD}@${RDS_HOST}:5432/postgres?sslmode=require"
export PGPASSWORD="$RDS_MASTER_PASSWORD"

echo "==> connecting as master to ${RDS_HOST}"
psql "$MASTER_URL" -qtAc 'select version();' | head -1

echo "==> creating role ${APP_USER} (if absent)"
psql "$MASTER_URL" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}') THEN
    CREATE ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}';
  ELSE
    ALTER ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}';
  END IF;
END
\$\$;
SQL

# Postgres 16+ requires the creating role to be a member of the owner role
# ("must be able to SET ROLE"). The RDS master user is not a superuser, so grant
# it membership first. Quoted because master usernames may be mixed-case.
echo "==> granting ${APP_USER} membership to ${RDS_MASTER_USER}"
psql "$MASTER_URL" -v ON_ERROR_STOP=1 -qc "GRANT ${APP_USER} TO \"${RDS_MASTER_USER}\";"

echo "==> creating database ${APP_DB} owned by ${APP_USER} (if absent)"
# CREATE DATABASE cannot run inside a transaction block, hence the separate call.
if ! psql "$MASTER_URL" -qtAc "SELECT 1 FROM pg_database WHERE datname='${APP_DB}';" | grep -q 1; then
  psql "$MASTER_URL" -v ON_ERROR_STOP=1 -qc "CREATE DATABASE ${APP_DB} OWNER ${APP_USER};"
else
  echo "    already exists — leaving it alone"
fi

APP_DB_MASTER_URL="postgresql://${RDS_MASTER_USER}:${RDS_MASTER_PASSWORD}@${RDS_HOST}:5432/${APP_DB}?sslmode=require"

echo "==> granting schema ownership and pre-creating pgcrypto"
# pgcrypto is created by the master so the app role does not need superuser.
# The init migration uses CREATE EXTENSION IF NOT EXISTS, so it becomes a no-op.
# Schema ownership lets Prisma create tables, types and functions
# (generate_prefixed_cuid) during migrate deploy.
psql "$APP_DB_MASTER_URL" -v ON_ERROR_STOP=1 -q <<SQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER SCHEMA public OWNER TO ${APP_USER};
GRANT ALL ON SCHEMA public TO ${APP_USER};
GRANT ALL ON DATABASE ${APP_DB} TO ${APP_USER};
-- Keep other roles out of this database.
REVOKE ALL ON DATABASE ${APP_DB} FROM PUBLIC;
SQL

echo "==> verifying the app role can connect and create"
APP_URL="postgresql://${APP_USER}:${APP_PASSWORD}@${RDS_HOST}:5432/${APP_DB}?sslmode=require"
psql "$APP_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE _comp_bootstrap_check (id text PRIMARY KEY);
CREATE OR REPLACE FUNCTION _comp_bootstrap_fn() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql;
SELECT gen_random_uuid();  -- proves pgcrypto is available to the app role
DROP FUNCTION _comp_bootstrap_fn();
DROP TABLE _comp_bootstrap_check;
SQL
echo "    OK: connect + create table + create function + pgcrypto all work"

# With --write-env, inject DATABASE_URL straight into the four env files so the
# credentials never have to be copied, pasted or shared. Default is to print.
if [[ "${1:-}" == "--write-env" ]]; then
  ROOT="${COMP_ROOT:-$HOME/comp}"
  wrote=0
  for f in "$ROOT/packages/db/.env" "$ROOT/apps/api/.env" \
           "$ROOT/apps/app/.env" "$ROOT/apps/portal/.env"; do
    if [[ -f "$f" ]]; then
      # Unquoted and comment-free: docker compose env_file takes values literally.
      grep -v '^DATABASE_URL=' "$f" > "$f.tmp" || true
      printf 'DATABASE_URL=%s\n' "$APP_URL" >> "$f.tmp"
      mv "$f.tmp" "$f"
      chmod 600 "$f"
      echo "    wrote DATABASE_URL -> $f"
      wrote=$((wrote+1))
    else
      echo "    SKIPPED (missing): $f"
    fi
  done
  echo
  echo "============================================================"
  echo "DATABASE_URL written to $wrote file(s). Nothing printed."
  if [[ "${GENERATED:-0}" == "1" ]]; then
    echo "The app password was generated and written only to those files."
    echo "To copy it into a password manager:"
    echo "  grep '^DATABASE_URL=' $ROOT/apps/api/.env"
  fi
  echo "============================================================"
else
  echo
  echo "============================================================"
  echo "DATABASE_URL (put this in all four .env files):"
  echo
  echo "DATABASE_URL=${APP_URL}"
  echo
  if [[ "${GENERATED:-0}" == "1" ]]; then
    echo "Generated app password: ${APP_PASSWORD}"
    echo "Store it in a password manager now — it is not written to disk."
  fi
  echo "Tip: re-run with --write-env to write it into ~/comp/**/.env instead"
  echo "     of printing it."
  echo "============================================================"
fi
