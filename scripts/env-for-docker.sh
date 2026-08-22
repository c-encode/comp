#!/usr/bin/env bash
# Docker's env_file / --env-file does NOT parse shell quoting: it takes each
# value literally, so `KEY="value"` arrives as `"value"` (quotes included) and
# `KEY=value # note` keeps the comment. dotenv (used by next/bun locally) does
# strip both, which is why the same file works in dev and breaks in a container.
#
# This rewrites the four .env files in place into a Docker-safe form.
# Idempotent: running it twice changes nothing.
#
#   ./scripts/env-for-docker.sh            # rewrite in place (makes .bak copies)
#   ./scripts/env-for-docker.sh --check    # report offending lines, change nothing
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

FILES=(apps/app/.env apps/portal/.env apps/api/.env packages/db/.env)
check_only=false
[[ "${1:-}" == "--check" ]] && check_only=true

status=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "skip (missing): $f"; continue; }
  bad=$(grep -cE '^[A-Za-z0-9_]+="|^[A-Za-z0-9_]+=[^#]*[[:space:]]#' "$f" || true)
  if $check_only; then
    [[ "$bad" -gt 0 ]] && { echo "$f: $bad line(s) need fixing"; status=1; } || echo "$f: ok"
  else
    if [[ "$bad" -gt 0 ]]; then
      cp "$f" "$f.bak"
      sed -E -i '' 's/[[:space:]]+#.*$//; s/^([A-Za-z0-9_]+)="(.*)"$/\1=\2/' "$f" 2>/dev/null \
        || sed -E -i 's/[[:space:]]+#.*$//; s/^([A-Za-z0-9_]+)="(.*)"$/\1=\2/' "$f"
      echo "$f: rewrote $bad line(s) (backup at $f.bak)"
    else
      echo "$f: already docker-safe"
    fi
  fi
done
exit $status
